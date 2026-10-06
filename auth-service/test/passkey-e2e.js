/**
 * Software WebAuthn authenticator, used to exercise the passkey endpoints
 * without a browser. Implements just enough of CTAP/WebAuthn to produce
 * attestations and assertions @simplewebauthn/server will accept.
 */
const crypto = require('crypto');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const ORIGIN = process.env.WEBAUTHN_EXPECTED_ORIGIN || 'http://localhost:3000';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';

const out = [];
const log = (s) => out.push(s);
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const sha256 = (b) => crypto.createHash('sha256').update(b).digest();

/* ---------- minimal CBOR (only what attestation needs) ---------- */
function head(major, value) {
  if (value < 24) return Buffer.from([(major << 5) | value]);
  if (value < 256) return Buffer.from([(major << 5) | 24, value]);
  if (value < 65536) {
    const b = Buffer.alloc(3);
    b[0] = (major << 5) | 25;
    b.writeUInt16BE(value, 1);
    return b;
  }
  const b = Buffer.alloc(5);
  b[0] = (major << 5) | 26;
  b.writeUInt32BE(value, 1);
  return b;
}
const cUint = (n) => head(0, n);
const cNint = (n) => head(1, -1 - n); // CBOR encodes -1 as value 0
const cBytes = (b) => Buffer.concat([head(2, b.length), b]);
const cText = (s) => {
  const b = Buffer.from(s, 'utf8');
  return Buffer.concat([head(3, b.length), b]);
};
const cMap = (pairs) =>
  Buffer.concat([head(5, pairs.length), ...pairs.map((p) => Buffer.concat(p))]);

/* ---------- the authenticator ---------- */
class SoftAuthenticator {
  constructor() {
    this.credId = crypto.randomBytes(32);
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    });
    this.privateKey = privateKey;
    // Raw uncompressed point: 0x04 || X(32) || Y(32)
    const raw = publicKey.export({ format: 'der', type: 'spki' });
    const point = raw.subarray(raw.length - 65);
    this.x = point.subarray(1, 33);
    this.y = point.subarray(33, 65);
    this.counter = 0;
  }

  coseKey() {
    return cMap([
      [cUint(1), cUint(2)], // kty: EC2
      [cUint(3), cNint(-7)], // alg: ES256
      [cNint(-1), cUint(1)], // crv: P-256
      [cNint(-2), cBytes(this.x)],
      [cNint(-3), cBytes(this.y)],
    ]);
  }

  authData({ attested }) {
    const rpIdHash = sha256(Buffer.from(RP_ID, 'utf8'));
    // UP (0x01) | UV (0x04) | AT (0x40 when attested credential data present)
    const flags = Buffer.from([attested ? 0x45 : 0x05]);
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(this.counter, 0);
    if (!attested) return Buffer.concat([rpIdHash, flags, counter]);

    const aaguid = Buffer.alloc(16);
    const credLen = Buffer.alloc(2);
    credLen.writeUInt16BE(this.credId.length, 0);
    return Buffer.concat([
      rpIdHash,
      flags,
      counter,
      aaguid,
      credLen,
      this.credId,
      this.coseKey(),
    ]);
  }

  clientData(type, challenge) {
    return Buffer.from(
      JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false }),
      'utf8',
    );
  }

  attestation(challenge) {
    const clientDataJSON = this.clientData('webauthn.create', challenge);
    const authData = this.authData({ attested: true });
    const attestationObject = cMap([
      [cText('fmt'), cText('none')],
      [cText('attStmt'), cMap([])],
      [cText('authData'), cBytes(authData)],
    ]);
    return {
      id: b64u(this.credId),
      rawId: b64u(this.credId),
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64u(clientDataJSON),
        attestationObject: b64u(attestationObject),
        transports: ['internal'],
      },
    };
  }

  assertion(challenge, userId) {
    this.counter += 1; // authenticators increment on every use
    const clientDataJSON = this.clientData('webauthn.get', challenge);
    const authData = this.authData({ attested: false });
    const signature = crypto
      .createSign('SHA256')
      .update(Buffer.concat([authData, sha256(clientDataJSON)]))
      .sign(this.privateKey); // DER, as WebAuthn requires for ES256
    return {
      id: b64u(this.credId),
      rawId: b64u(this.credId),
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64u(clientDataJSON),
        authenticatorData: b64u(authData),
        signature: b64u(signature),
        userHandle: userId ? b64u(Buffer.from(userId, 'utf8')) : undefined,
      },
    };
  }
}

/* ---------- http ---------- */
async function call(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let d;
  try {
    d = t ? JSON.parse(t) : null;
  } catch {
    d = t;
  }
  return { ok: r.ok, status: r.status, d };
}

const check = (name, cond, detail = '') =>
  log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);

/* ---------- the run ---------- */
(async () => {
  const email = `pk${Date.now()}@example.com`;
  const auth = new SoftAuthenticator();

  // A verified user is required before any passkey endpoint will work.
  let r = await call('POST', '/auth/register', {
    email,
    password: 'Password@123',
    name: 'Passkey Test',
  });
  const userId = r.d?.id;
  await call('POST', '/auth/verify-email', { token: r.d?.verificationToken });
  check('setup: user registered + verified', !!userId);

  // 1. registration ceremony
  r = await call(
    'GET',
    `/passkeys/register/generate-options?email=${encodeURIComponent(email)}`,
  );
  check('register/generate-options returns a challenge', r.ok && !!r.d?.challenge);
  const regChallenge = r.d?.challenge;

  const attestation = auth.attestation(regChallenge);
  r = await call('POST', '/passkeys/register/verify', {
    email,
    response: attestation,
  });
  check('register/verify accepts a valid attestation', r.ok && r.d?.success === true,
    r.ok ? '' : JSON.stringify(r.d).slice(0, 140));

  // 2. the challenge must be single use (replay the exact same payload)
  r = await call('POST', '/passkeys/register/verify', {
    email,
    response: attestation,
  });
  check('register/verify rejects a replayed attestation', !r.ok,
    `status ${r.status}`);

  // 3. authentication ceremony
  r = await call(
    'GET',
    `/passkeys/authenticate/generate-options?email=${encodeURIComponent(email)}`,
  );
  check('authenticate/generate-options returns a challenge', r.ok && !!r.d?.challenge);
  const authChallenge = r.d?.challenge;

  r = await call('POST', '/passkeys/authenticate/verify', {
    response: auth.assertion(authChallenge, userId),
  });
  check('authenticate/verify accepts a valid assertion',
    r.ok && r.d?.success === true && r.d?.user?.email === email,
    r.ok ? `user=${r.d?.user?.email}` : JSON.stringify(r.d).slice(0, 140));

  // 4. step-up bound to a transaction id
  const txn = 'order-42';
  r = await call('POST', '/passkeys/transaction/generate-options', {
    userId,
    transactionId: txn,
  });
  check('transaction/generate-options returns options', r.ok && !!r.d?.options?.challenge);
  const txnChallenge = r.d?.options?.challenge;

  r = await call('POST', '/passkeys/transaction/verify', {
    response: auth.assertion(txnChallenge, userId),
    transactionId: txn,
  });
  check('transaction/verify accepts the step-up assertion',
    r.ok && r.d?.verifiedUserId === userId,
    r.ok ? '' : JSON.stringify(r.d).slice(0, 140));

  // 5. an assertion from a normal login must NOT authorise a transaction
  r = await call(
    'GET',
    `/passkeys/authenticate/generate-options?email=${encodeURIComponent(email)}`,
  );
  const loginChallenge = r.d?.challenge;
  r = await call('POST', '/passkeys/transaction/verify', {
    response: auth.assertion(loginChallenge, userId),
    transactionId: 'order-99',
  });
  check('transaction/verify rejects a login assertion (challenge is txn-bound)',
    !r.ok, `status ${r.status}`);

  // 6. unknown credential is rejected
  const stranger = new SoftAuthenticator();
  r = await call(
    'GET',
    `/passkeys/authenticate/generate-options?email=${encodeURIComponent(email)}`,
  );
  r = await call('POST', '/passkeys/authenticate/verify', {
    response: stranger.assertion(r.d?.challenge, userId),
  });
  check('authenticate/verify rejects an unregistered credential', !r.ok,
    `status ${r.status}`);

  log(`\n(test user: ${email})`);
  fs.writeFileSync('passkey.out.txt', out.join('\n'));
})().catch((e) => {
  log('ERROR: ' + e.stack);
  fs.writeFileSync('passkey.out.txt', out.join('\n'));
});

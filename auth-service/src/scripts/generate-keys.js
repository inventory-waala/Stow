const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keysDir = path.join(__dirname, '..', '..', 'keys');

// Ensure directory exists
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

console.log('Generating RSA key pair...');

crypto.generateKeyPair('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
}, (err, publicKey, privateKey) => {
  if (err) {
    console.error('Failed to generate keys:', err);
    return;
  }

  const publicPath = path.join(keysDir, 'public.pem');
  const privatePath = path.join(keysDir, 'private.pem');

  fs.writeFileSync(publicPath, publicKey);
  fs.writeFileSync(privatePath, privateKey);

  console.log('Successfully generated RSA keys!');
  console.log(`Public key saved to: ${publicPath}`);
  console.log(`Private key saved to: ${privatePath}`);
});

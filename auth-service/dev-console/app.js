/* Auth Service dev console — no dependencies, no build step. */

const $ = (id) => document.getElementById(id);
const state = {
  accessToken: null,
  refreshToken: null,
  userId: null,
  claims: null,
};

/* ---------------- persistence (best effort) ---------------- */

const STORE_KEY = 'auth-console';

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    localStorage.setItem(STORE_KEY + ':base', $('baseUrl').value);
  } catch (_) {
    /* private window or blocked storage — the console still works */
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
    const base = localStorage.getItem(STORE_KEY + ':base');
    if (base) $('baseUrl').value = base;
  } catch (_) {
    /* ignore */
  }
}

// Default is the same-origin '/api' proxy (see server.js). Keeping it
// same-origin means no CORS, and one HTTPS tunnel covers page + API --
// which is what makes passkey testing from a phone possible.
const baseUrl = () => $('baseUrl').value.replace(/\/+$/, '');

/* ---------------- request log ---------------- */

function logRequest(method, path, status, ms, body) {
  const log = $('log');
  const placeholder = log.querySelector('.empty');
  if (placeholder) placeholder.remove();

  const cls = status === 0 ? 's0' : 's' + String(status)[0];
  const entry = document.createElement('details');
  entry.className = 'entry';
  entry.open = true;

  const summary = document.createElement('summary');
  const code = document.createElement('span');
  code.className = 'code ' + cls;
  code.textContent = status || 'ERR';
  const p = document.createElement('span');
  p.className = 'path';
  p.textContent = method + ' ' + path;
  const t = document.createElement('span');
  t.className = 'ms';
  t.textContent = ms + 'ms';
  summary.append(code, p, t);

  const pre = document.createElement('pre');
  pre.textContent =
    typeof body === 'string' ? body : JSON.stringify(body, null, 2);

  entry.append(summary, pre);
  log.prepend(entry);

  // Keep only the most recent 25 entries.
  while (log.children.length > 25) log.lastElementChild.remove();
}

/* ---------------- api ---------------- */

async function api(method, path, { body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    if (!state.accessToken) {
      logRequest(method, path, 0, 0, 'No access token — log in first.');
      return { ok: false, data: null };
    }
    headers.Authorization = 'Bearer ' + state.accessToken;
  }

  const started = performance.now();
  try {
    const res = await fetch(baseUrl() + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const ms = Math.round(performance.now() - started);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = text;
    }
    logRequest(method, path, res.status, ms, data);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    logRequest(
      method,
      path,
      0,
      ms,
      'Network/CORS failure: ' +
        err.message +
        '\n\nIs the service running on ' +
        baseUrl() +
        ' ? Is this origin in CORS_ORIGINS?',
    );
    return { ok: false, status: 0, data: null };
  }
}

/* ---------------- session ---------------- */

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch (_) {
    return null;
  }
}

function setTokens(data) {
  if (!data) return;
  if (data.accessToken) {
    state.accessToken = data.accessToken;
    state.claims = decodeJwt(data.accessToken);
    if (state.claims?.id) state.userId = state.claims.id;
  }
  if (data.refreshToken) state.refreshToken = data.refreshToken;
  save();
  renderSession();
  prefillIds();
}

function renderSession() {
  const el = $('sessionBody');
  if (!state.accessToken) {
    el.innerHTML = '<p class="empty">Not signed in.</p>';
    return;
  }

  const c = state.claims || {};
  const exp = c.exp ? new Date(c.exp * 1000) : null;
  const expired = exp && exp < new Date();

  const pills = (arr) =>
    arr && arr.length
      ? arr.map((x) => `<span class="pill">${escapeHtml(x)}</span>`).join('')
      : '<span class="empty">none</span>';

  el.innerHTML = `
    <dl class="claims">
      <dt>User</dt><dd>${escapeHtml(c.email || '—')}</dd>
      <dt>User ID</dt><dd>${escapeHtml(c.id || '—')}</dd>
      <dt>Tenant</dt><dd>${escapeHtml(c.tenant_id || '— (no tenant context)')}</dd>
      <dt>Verified</dt><dd>${c.is_email_verified ? 'yes' : 'no'}</dd>
      <dt>Expires</dt><dd>${
        exp
          ? escapeHtml(exp.toLocaleTimeString()) +
            (expired ? ' <strong>(expired)</strong>' : '')
          : '—'
      }</dd>
    </dl>
    <div style="margin-top:12px">
      <label>Roles</label>${pills(c.roles)}
    </div>
    <div style="margin-top:8px">
      <label>Permissions</label>${pills(c.permissions)}
    </div>
    <div style="margin-top:12px">
      <label>Access token</label>
      <div class="token">${escapeHtml(state.accessToken)}</div>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );
}

/** Copy ids from the session into the forms that need them. */
function prefillIds() {
  const c = state.claims || {};
  const set = (id, v) => {
    const el = $(id);
    if (el && !el.value && v) el.value = v;
  };
  set('assignUserId', c.id);
  set('pkUserId', c.id);
  set('roleTenant', c.tenant_id);
  set('assignTenantId', c.tenant_id);
}

/* ---------------- WebAuthn helpers ---------------- */

const b64urlToBuf = (s) => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
};

const bufToB64url = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

function toCreationOptions(o) {
  return {
    ...o,
    challenge: b64urlToBuf(o.challenge),
    user: { ...o.user, id: b64urlToBuf(o.user.id) },
    excludeCredentials: (o.excludeCredentials || []).map((c) => ({
      ...c,
      id: b64urlToBuf(c.id),
    })),
  };
}

function toRequestOptions(o) {
  return {
    ...o,
    challenge: b64urlToBuf(o.challenge),
    allowCredentials: (o.allowCredentials || []).map((c) => ({
      ...c,
      id: b64urlToBuf(c.id),
    })),
  };
}

function attestationToJSON(cred) {
  return {
    id: cred.id,
    rawId: bufToB64url(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults(),
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
    response: {
      clientDataJSON: bufToB64url(cred.response.clientDataJSON),
      attestationObject: bufToB64url(cred.response.attestationObject),
      transports: cred.response.getTransports ? cred.response.getTransports() : [],
    },
  };
}

function assertionToJSON(cred) {
  return {
    id: cred.id,
    rawId: bufToB64url(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults(),
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
    response: {
      clientDataJSON: bufToB64url(cred.response.clientDataJSON),
      authenticatorData: bufToB64url(cred.response.authenticatorData),
      signature: bufToB64url(cred.response.signature),
      userHandle: cred.response.userHandle
        ? bufToB64url(cred.response.userHandle)
        : undefined,
    },
  };
}

function assertWebAuthn() {
  if (!window.PublicKeyCredential) {
    logRequest('—', 'WebAuthn', 0, 0, 'This browser has no WebAuthn support.');
    return false;
  }
  return true;
}

/* ---------------- actions ---------------- */

const actions = {
  async register() {
    const { data } = await api('POST', '/auth/register', {
      body: {
        email: $('regEmail').value,
        password: $('regPassword').value,
        name: $('regName').value,
      },
    });
    if (data?.verificationToken) $('verifyToken').value = data.verificationToken;
    if (data?.id) {
      $('assignUserId').value = data.id;
      $('pkUserId').value = data.id;
    }
    if (data?.tenantId) {
      $('switchTenantId').value = data.tenantId;
      $('roleTenant').value = data.tenantId;
      $('assignTenantId').value = data.tenantId;
    }
  },

  async verify() {
    await api('POST', '/auth/verify-email', {
      body: { token: $('verifyToken').value },
    });
  },

  async login() {
    const body = {
      email: $('loginEmail').value,
      password: $('loginPassword').value,
    };
    const tenant = $('loginTenant').value.trim();
    if (tenant) body.tenant_id = tenant;
    const { data } = await api('POST', '/auth/login', { body });
    setTokens(data);
  },

  async me() {
    const { data } = await api('GET', '/auth/me', { auth: true });
    if (data?.id) {
      state.userId = data.id;
      save();
    }
  },

  async refresh() {
    const { data } = await api('POST', '/auth/refresh', {
      body: { user_id: state.userId, token: state.refreshToken },
    });
    setTokens(data);
  },

  async logout() {
    await api('POST', '/auth/logout', {
      body: { user_id: state.userId, token: state.refreshToken },
    });
    actions.clearSession();
  },

  async forgot() {
    const { data } = await api('POST', '/auth/forgot-password', {
      body: { email: $('forgotEmail').value },
    });
    if (data?.resetToken) $('resetToken').value = data.resetToken;
  },

  async reset() {
    await api('POST', '/auth/reset-password', {
      body: { token: $('resetToken').value, newPassword: $('newPassword').value },
    });
  },

  async myTenants() {
    const { data } = await api('GET', '/tenants/me', { auth: true });
    const box = $('tenantList');
    if (!Array.isArray(data) || !data.length) {
      box.innerHTML = '<p class="empty">No tenants.</p>';
      return;
    }
    box.innerHTML = data
      .map(
        (t) =>
          `<div class="token" style="margin-bottom:6px"><strong>${escapeHtml(
            t.name,
          )}</strong><br>${escapeHtml(t.id)}</div>`,
      )
      .join('');
    if (!$('switchTenantId').value) $('switchTenantId').value = data[0].id;
  },

  async createTenant() {
    const { data } = await api('POST', '/tenants', {
      auth: true,
      body: {
        name: $('tenantName').value,
        description: $('tenantDesc').value,
      },
    });
    if (data?.id) {
      $('switchTenantId').value = data.id;
      $('roleTenant').value = data.id;
      $('assignTenantId').value = data.id;
    }
  },

  async switchTenant() {
    const { data } = await api('POST', '/auth/switch-tenant', {
      auth: true,
      body: { tenant_id: $('switchTenantId').value },
    });
    setTokens(data);
  },

  async createRole() {
    const { data } = await api('POST', '/auth/roles', {
      auth: true,
      body: {
        tenant_id: $('roleTenant').value,
        name: $('roleName').value,
        description: $('roleDesc').value,
      },
    });
    if (data?.id) {
      $('permRoleId').value = data.id;
      $('assignRoleId').value = data.id;
    }
  },

  async assignPerms() {
    await api('POST', '/auth/roles/permissions', {
      auth: true,
      body: {
        role_id: $('permRoleId').value,
        permissions: $('permList')
          .value.split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      },
    });
  },

  async assignRole() {
    await api('POST', '/auth/roles/assign', {
      auth: true,
      body: {
        user_id: $('assignUserId').value,
        role_id: $('assignRoleId').value,
        tenant_id: $('assignTenantId').value,
      },
    });
  },

  async revokeRole() {
    await api('DELETE', '/auth/roles/revoke', {
      auth: true,
      body: {
        user_id: $('assignUserId').value,
        role_id: $('assignRoleId').value,
        tenant_id: $('assignTenantId').value,
      },
    });
  },

  async pkRegister() {
    if (!assertWebAuthn()) return;
    const email = $('pkEmail').value;
    const { ok, data } = await api(
      'GET',
      '/passkeys/register/generate-options?email=' + encodeURIComponent(email),
    );
    if (!ok || !data) return;
    let cred;
    try {
      cred = await navigator.credentials.create({
        publicKey: toCreationOptions(data),
      });
    } catch (e) {
      logRequest('—', 'navigator.credentials.create', 0, 0, e.message);
      return;
    }
    await api('POST', '/passkeys/register/verify', {
      body: { email, response: attestationToJSON(cred) },
    });
  },

  async pkAuth() {
    if (!assertWebAuthn()) return;
    const email = $('pkEmail').value;
    const { ok, data } = await api(
      'GET',
      '/passkeys/authenticate/generate-options?email=' + encodeURIComponent(email),
    );
    if (!ok || !data) return;
    let cred;
    try {
      cred = await navigator.credentials.get({
        publicKey: toRequestOptions(data),
      });
    } catch (e) {
      logRequest('—', 'navigator.credentials.get', 0, 0, e.message);
      return;
    }
    await api('POST', '/passkeys/authenticate/verify', {
      body: { response: assertionToJSON(cred) },
    });
  },

  async pkStepUp() {
    if (!assertWebAuthn()) return;
    const transactionId = $('pkTxnId').value;
    const { ok, data } = await api('POST', '/passkeys/transaction/generate-options', {
      body: { userId: $('pkUserId').value, transactionId },
    });
    if (!ok || !data?.options) return;
    let cred;
    try {
      cred = await navigator.credentials.get({
        publicKey: toRequestOptions(data.options),
      });
    } catch (e) {
      logRequest('—', 'navigator.credentials.get', 0, 0, e.message);
      return;
    }
    await api('POST', '/passkeys/transaction/verify', {
      body: { response: assertionToJSON(cred), transactionId },
    });
  },

  clearSession() {
    state.accessToken = null;
    state.refreshToken = null;
    state.claims = null;
    save();
    renderSession();
  },

  clearLog() {
    $('log').innerHTML = '<p class="empty">No requests yet.</p>';
  },
};

/* ---------------- wiring ---------------- */

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (btn) {
    const fn = actions[btn.dataset.act];
    if (!fn) return;
    btn.disabled = true;
    try {
      await fn();
    } finally {
      btn.disabled = false;
    }
    return;
  }

  const tab = e.target.closest('[data-tab]');
  if (tab) {
    document
      .querySelectorAll('[data-tab]')
      .forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    document
      .querySelectorAll('[data-panel]')
      .forEach((p) => (p.hidden = p.dataset.panel !== tab.dataset.tab));
  }
});

/* ---------------- health ---------------- */

async function ping() {
  const el = $('health');
  const text = $('healthText');
  try {
    const res = await fetch(baseUrl() + '/', { method: 'GET' });
    el.className = 'status ' + (res.ok ? 'up' : 'down');
    text.textContent = res.ok ? 'service up' : 'HTTP ' + res.status;
  } catch (_) {
    el.className = 'status down';
    text.textContent = 'unreachable';
  }
}

$('baseUrl').addEventListener('change', () => {
  save();
  ping();
});

restore();
renderSession();
prefillIds();
ping();
setInterval(ping, 15000);

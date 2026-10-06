# Auth Service — Postman Testing Guide

## 0. Prerequisites

**One-time setup:**

```bash
npm install                 # run from the monorepo root (npm workspaces)
npm run keys:generate       # writes keys/private.pem + keys/public.pem
cp .env.example .env        # then fill in DATABASE_URL
npm run prisma:generate
npm run prisma:migrate      # applies migrations to DATABASE_URL
```

**Start the app:**

```bash
npm run start:dev           # HTTP on :3001, gRPC on :50051
```

> `DATABASE_URL` is the single database variable — `PrismaService` and
> `prisma.config.ts` both read it. The service refuses to boot without it, and
> verifies the connection before it starts listening.

Set a Postman **collection variable**: `BASE_URL = http://localhost:3001`

---

## 0b. Browser console (instead of Postman)

```bash
npm run console        # serves the dev console on http://localhost:3000
```

A dependency-free page that drives every flow below, shows the decoded JWT
(tenant, roles, permissions, expiry) and logs each request/response.

It is served on port **3000** on purpose: that origin is already in
`CORS_ORIGINS` and matches `WEBAUTHN_EXPECTED_ORIGIN` / `WEBAUTHN_RP_ID`, so the
passkey ceremonies in section 10 work against a real authenticator (Windows
Hello, Touch ID). Opening the file over `file://` will not work — the origin is
`null` and CORS will reject it.

---

## 1. Register a User — `POST {{BASE_URL}}/auth/register`

```json
{
  "email": "test@example.com",
  "password": "Password@123",
  "name": "Test User"
}
```

**Expected:** `201 Created` with a user profile.
The user starts with `status: PENDING_VERIFICATION`.

Registration also auto-provisions a **tenant** for the user and assigns them the
`owner` role in it. The response includes `tenantId` and `verificationToken`.

---

## 2. Verify Email — `POST {{BASE_URL}}/auth/verify-email`

Use the `verificationToken` from step 1 (it is returned directly until email
sending moves to the notification-service in Phase 10).

```json
{ "token": "<raw_verification_token>" }
```

**Expected:** `{ "message": "Email verified successfully" }`
User status becomes `ACTIVE`. Login is blocked until this succeeds.

---

## 3. Login — `POST {{BASE_URL}}/auth/login`

```json
{
  "email": "test@example.com",
  "password": "Password@123"
}
```

**Expected:** `{ accessToken: "...", refreshToken: "..." }`
Save both as `ACCESS_TOKEN` and `REFRESH_TOKEN`.

When `tenant_id` is omitted, the service falls back to the user's first tenant
membership — so a freshly registered user gets a token already scoped to their
auto-provisioned tenant. Decoding at [jwt.io](https://jwt.io) shows `tenant_id`
and `roles: ["owner"]`. Pass an explicit `tenant_id` to log into a specific one.

---

## 4. Get Current User — `GET {{BASE_URL}}/auth/me`

**Headers:** `Authorization: Bearer {{ACCESS_TOKEN}}`

**Expected:** Your profile read fresh from the database, plus the `tenant_id`,
`roles`, and `permissions` the token was issued for.

---

## 5. Refresh Token — `POST {{BASE_URL}}/auth/refresh`

```json
{
  "user_id": "<your_user_id>",
  "token": "{{REFRESH_TOKEN}}"
}
```

**Expected:** A brand new `{ accessToken, refreshToken }` pair. Update both
variables. The old refresh token is now revoked, and the new one keeps the
original expiry.

---

## 6. Logout — `POST {{BASE_URL}}/auth/logout`

```json
{
  "user_id": "<your_user_id>",
  "token": "{{REFRESH_TOKEN}}"
}
```

**Expected:** `{ "message": "Successfully logged out" }`

---

## 7. Forgot Password — `POST {{BASE_URL}}/auth/forgot-password`

```json
{ "email": "test@example.com" }
```

**Expected:** `{ message: "...", resetToken: "<raw_reset_token>" }`

> The `resetToken` is returned directly in the response for now (Kafka
> integration pending). Save it as `RESET_TOKEN`. The message is deliberately
> identical for unknown emails to avoid enumeration.

---

## 8. Reset Password — `POST {{BASE_URL}}/auth/reset-password`

```json
{
  "token": "{{RESET_TOKEN}}",
  "newPassword": "NewPassword@456"
}
```

**Expected:** `{ "message": "Password has been changed successfully" }`
Login again with your new password to confirm.

---

## 9. Tenants & RBAC

> All endpoints below require `Authorization: Bearer {{ACCESS_TOKEN}}`.
>
> **Role administration is scoped to the tenant your token is currently issued
> for**, and requires the `owner` or `admin` role in that tenant. A token whose
> `tenant_id` does not match the `tenant_id` in the request body is rejected
> with `403`. This is why step 9b comes before 9c.

### 9a. List Your Tenants — `GET {{BASE_URL}}/tenants/me`

**Expected:** At least the tenant auto-created during registration.

### 9b. Create a Tenant — `POST {{BASE_URL}}/tenants`

```json
{
  "name": "Acme Corp",
  "description": "Second tenant"
}
```

**Expected:** The created tenant. You are automatically assigned its `owner`
role — creating a tenant you could not administer would strand it. Save
`tenant_id`.

### 9c. Switch Into It — `POST {{BASE_URL}}/auth/switch-tenant`

```json
{ "tenant_id": "<tenant_id>" }
```

**Expected:** `{ accessToken }` scoped to the new tenant. **Replace
`ACCESS_TOKEN` with this** before continuing — the remaining steps act inside
this tenant.

### 9d. Create a Role — `POST {{BASE_URL}}/auth/roles`

```json
{
  "tenant_id": "<tenant_id>",
  "name": "manager",
  "description": "Day-to-day operations"
}
```

**Expected:** The created role object. Save `role_id`.

### 9e. Assign Permissions to Role — `POST {{BASE_URL}}/auth/roles/permissions`

```json
{
  "role_id": "<role_id>",
  "permissions": ["inventory.read", "inventory.write", "order.create"]
}
```

**Expected:** `{ "assigned": 3 }`

### 9f. Assign Role to User — `POST {{BASE_URL}}/auth/roles/assign`

```json
{
  "user_id": "<your_user_id>",
  "role_id": "<role_id>",
  "tenant_id": "<tenant_id>"
}
```

### 9g. Login with Tenant — `POST {{BASE_URL}}/auth/login`

```json
{
  "email": "test@example.com",
  "password": "NewPassword@456",
  "tenant_id": "<tenant_id>"
}
```

**Expected:** A JWT where decoding at [jwt.io](https://jwt.io) shows:

```json
{
  "roles": ["owner", "manager"],
  "permissions": ["inventory.read", "inventory.write", "order.create"],
  "tenant_id": "<tenant_id>"
}
```

### 9h. Revoke Role — `DELETE {{BASE_URL}}/auth/roles/revoke`

```json
{
  "user_id": "<your_user_id>",
  "role_id": "<role_id>",
  "tenant_id": "<tenant_id>"
}
```

**Expected:** `{ "message": "Role revoked successfully" }`
Login again with `tenant_id` — the revoked role and its permissions are gone.

---

## 10. Passkeys (WebAuthn)

These need a real browser/authenticator; the challenge is held server-side, so
**the client never sends `expectedChallenge`**. Request options, sign them with
the authenticator, then post the credential back within 5 minutes. Each
challenge is single-use.

### 10a. Register — `GET {{BASE_URL}}/passkeys/register/generate-options?email=test@example.com`

Pass the result to `navigator.credentials.create()`, then:

`POST {{BASE_URL}}/passkeys/register/verify`

```json
{ "email": "test@example.com", "response": { "...": "credential JSON" } }
```

### 10b. Authenticate — `GET {{BASE_URL}}/passkeys/authenticate/generate-options?email=test@example.com`

Pass the result to `navigator.credentials.get()`, then:

`POST {{BASE_URL}}/passkeys/authenticate/verify`

```json
{ "response": { "...": "assertion JSON" } }
```

**Expected:** `{ success: true, user: { ... } }`

### 10c. Step-Up for an Action — `POST {{BASE_URL}}/passkeys/transaction/generate-options`

```json
{ "userId": "<your_user_id>", "transactionId": "order-42" }
```

Then `POST {{BASE_URL}}/passkeys/transaction/verify`:

```json
{ "response": { "...": "assertion JSON" }, "transactionId": "order-42" }
```

The challenge is bound to that exact `transactionId`, so an assertion captured
during a normal login cannot be replayed to authorise an action.

---

## 11. gRPC (port 50051)

`libs/proto/auth.proto` exposes `ValidateToken` and `GetUserByID` for other
services. Test with `grpcurl`:

```bash
grpcurl -plaintext -import-path ../libs/proto -proto auth.proto \
  -d '{"token":"<ACCESS_TOKEN>"}' \
  localhost:50051 auth.AuthService/ValidateToken
```

**Expected:** `{ "valid": true, "user_id": "...", "tenant_id": "...", "role": "owner" }`

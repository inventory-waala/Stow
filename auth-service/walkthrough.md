# Auth Service — Postman Testing Guide

## 0. Prerequisites

**Start your infrastructure (Docker) + the app:**

```bash
docker compose up -d        # starts Postgres (5432) + Redis (6379)
yarn start:dev              # starts NestJS on http://localhost:3000
```

Set a Postman **collection variable**: `BASE_URL = http://localhost:3000`

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

---

## 2. Verify Email — `POST {{BASE_URL}}/auth/verify-email`

> This relies on how you implemented Phase 6. The raw verification token is returned or emailed. Copy it from the DB via Prisma Studio (`yarn prisma studio`) if needed.

```json
{ "token": "<raw_verification_token>" }
```

**Expected:** `{ "message": "Email verified successfully" }`  
User status becomes `ACTIVE`.

---

## 3. Login (no tenant) — `POST {{BASE_URL}}/auth/login`

```json
{
  "email": "test@example.com",
  "password": "Password@123"
}
```

**Expected:** `{ accessToken: "...", refreshToken: "..." }`  
Save both tokens as Postman variables: `ACCESS_TOKEN`, `REFRESH_TOKEN`. Decode at [jwt.io](https://jwt.io) — `roles` and `permissions` will be absent since no `tenant_id` was sent.

---

## 4. Get Current User — `GET {{BASE_URL}}/auth/me`

**Headers:** `Authorization: Bearer {{ACCESS_TOKEN}}`  
**Expected:** Your user profile from the JWT.

---

## 5. Refresh Token — `POST {{BASE_URL}}/auth/refresh`

```json
{
  "user_id": "<your_user_id>",
  "token": "{{REFRESH_TOKEN}}"
}
```

**Expected:** A brand new `{ accessToken, refreshToken }` pair. Update both variables. The old refresh token is now revoked.

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

> The `resetToken` is returned directly in the response for now (Kafka integration pending). Save it as `RESET_TOKEN`.

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

## 9. RBAC Flow (Phase 8)

> All endpoints below require `Authorization: Bearer {{ACCESS_TOKEN}}` (any valid JWT).

### 9a. Create a Tenant

You can insert a row directly via Prisma Studio or use the DB. Save the `tenant_id`.

### 9b. Create a Role — `POST {{BASE_URL}}/auth/roles`

```json
{
  "tenant_id": "<tenant_id>",
  "name": "admin",
  "description": "Full access role"
}
```

**Expected:** The created role object. Save `role_id`.

### 9c. Assign Permissions to Role — `POST {{BASE_URL}}/auth/roles/permissions`

```json
{
  "role_id": "<role_id>",
  "permissions": ["inventory.read", "inventory.write", "order.create"]
}
```

**Expected:** `{ "assigned": 3 }`

### 9d. Assign Role to User — `POST {{BASE_URL}}/auth/roles/assign`

```json
{
  "user_id": "<your_user_id>",
  "role_id": "<role_id>",
  "tenant_id": "<tenant_id>"
}
```

### 9e. Login with Tenant — `POST {{BASE_URL}}/auth/login`

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
  "roles": ["admin"],
  "permissions": ["inventory.read", "inventory.write", "order.create"],
  "tenant_id": "<tenant_id>"
}
```

### 9f. Revoke Role — `DELETE {{BASE_URL}}/auth/roles/revoke`

```json
{
  "user_id": "<your_user_id>",
  "role_id": "<role_id>",
  "tenant_id": "<tenant_id>"
}
```

**Expected:** `{ "message": "Role revoked successfully" }`  
Login again with `tenant_id` — `roles` and `permissions` arrays should now be empty.

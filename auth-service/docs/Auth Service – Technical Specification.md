# Auth Service – Technical Specification

## Overview

The **Auth Service** is responsible for managing user identity, authentication, authorization, and token issuance for the SaaS platform. It is a **core security-critical microservice** and must be implemented using **NestJS with TypeScript**.

This service issues JWT tokens used by all other backend services and supports **multi-tenant role-based access control (RBAC)**.

---

# Technology Stack

## Framework

* NestJS (TypeScript)

## Runtime

* Node.js

## Database

* PostgreSQL

## ORM

* Prisma

## Cache / Session Store

* Redis

## Messaging

* Kafka

## Security Libraries

* bcrypt or argon2 (password hashing)
* jsonwebtoken / @nestjs/jwt
* helmet
* rate limiter

## Containerization

* Docker

## API Documentation

* Swagger (OpenAPI)

---

# Authentication Strategy

The platform uses **JWT Access Tokens + Refresh Tokens**.

## Access Token

* Expiry: 15 minutes
* Signed using: **RS256**
* Contains:

  * userId
  * tenantId
  * roles
  * permissions

Example payload:

```json
{
  "sub": "user_id",
  "tenantId": "tenant_id",
  "roles": ["admin"],
  "permissions": [
    "inventory.read",
    "inventory.write"
  ],
  "iat": 171000000,
  "exp": 171000900
}
```

## Refresh Token

* Expiry: 7–30 days
* Stored hashed in database
* Used to generate new access tokens

---

# Authentication Flows

## User Registration

1. Client sends registration request
2. Auth Service creates user
3. Email verification token generated
4. Event published to Kafka: `user.created`
5. Notification service sends verification email

---

## Login Flow

1. Client sends email + password
2. Auth service validates credentials
3. Access token + refresh token generated
4. Tokens returned to client

---

## Token Refresh Flow

1. Client sends refresh token
2. Auth service validates token
3. New access token generated
4. Old refresh token optionally rotated

---

## Logout Flow

1. Client sends logout request
2. Refresh token marked as revoked
3. Session invalidated

---

# Authorization Model

The system uses **Role-Based Access Control (RBAC)**.

## Role Hierarchy Example

Owner
Admin
Manager
Staff

---

## Permission Examples

```
inventory.read
inventory.update
inventory.adjust
order.create
order.cancel
customer.read
customer.create
user.invite
```

Permissions are attached to roles.

Users receive permissions through assigned roles within a tenant.

---

# Database Schema

Database: PostgreSQL

## users

| column            | type           |
| ----------------- | -------------- |
| id                | UUID (PK)      |
| email             | varchar unique |
| password_hash     | text           |
| status            | varchar        |
| is_email_verified | boolean        |
| created_at        | timestamp      |
| updated_at        | timestamp      |

Status values:

```
ACTIVE
SUSPENDED
PENDING_VERIFICATION
```

---

## roles

| column      | type      |
| ----------- | --------- |
| id          | UUID      |
| name        | varchar   |
| description | text      |
| created_at  | timestamp |

Example roles:

```
owner
admin
manager
staff
```

---

## permissions

| column      | type           |
| ----------- | -------------- |
| id          | UUID           |
| name        | varchar unique |
| description | text           |

---

## role_permissions

| column        | type |
| ------------- | ---- |
| role_id       | UUID |
| permission_id | UUID |

Primary Key:

```
(role_id, permission_id)
```

---

## user_roles (multi-tenant)

| column    | type |
| --------- | ---- |
| user_id   | UUID |
| tenant_id | UUID |
| role_id   | UUID |

Primary Key:

```
(user_id, tenant_id, role_id)
```

---

## refresh_tokens

| column     | type      |
| ---------- | --------- |
| id         | UUID      |
| user_id    | UUID      |
| token_hash | text      |
| expires_at | timestamp |
| created_at | timestamp |
| revoked    | boolean   |

Tokens must be stored **hashed**.

---

## email_verifications

| column     | type      |
| ---------- | --------- |
| id         | UUID      |
| user_id    | UUID      |
| token_hash | text      |
| expires_at | timestamp |

---

## password_resets

| column     | type      |
| ---------- | --------- |
| id         | UUID      |
| user_id    | UUID      |
| token_hash | text      |
| expires_at | timestamp |

---

## api_keys

| column     | type      |
| ---------- | --------- |
| id         | UUID      |
| tenant_id  | UUID      |
| key_hash   | text      |
| name       | varchar   |
| created_at | timestamp |
| expires_at | timestamp |

Used for integrations and server-to-server communication.

---

# Kafka Events

Auth Service publishes events to Kafka.

Topics:

```
user.created
user.login
user.invited
user.password.changed
user.email.verified
```

Example event:

```json
{
  "event": "user.created",
  "userId": "uuid",
  "email": "user@example.com",
  "tenantId": "tenant123",
  "timestamp": "2026-03-10T10:00:00Z"
}
```

Consumers may include:

* notification-service
* analytics-service
* audit-service

---

# API Endpoints

```
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/forgot-password
POST /auth/reset-password
GET  /auth/me
```

---

# Security Requirements

The service must implement:

* bcrypt/argon2 password hashing
* JWT RS256 signing
* login rate limiting
* brute force protection
* email verification
* secure HTTP headers (helmet)
* CORS restriction
* refresh token rotation

Optional advanced features:

* 2FA (TOTP)
* device tracking
* IP logging
* WebAuthn support

---

# NestJS Module Architecture

Directory structure:

```
src
 ├ modules
 │  ├ auth
 │  ├ users
 │  ├ roles
 │  ├ permissions
 │  ├ tokens
 │  └ api-keys
 │
 ├ guards
 ├ strategies
 ├ events
 ├ config
 ├ common
 └ main.ts
```

---

# Auth Module Structure

```
src/modules/auth

auth.controller.ts
auth.service.ts
auth.module.ts
jwt.strategy.ts
refresh.strategy.ts
```

---

# Infrastructure Dependencies

The auth service requires:

* PostgreSQL database
* Redis instance
* Kafka broker
* Docker container runtime

---

# Future Enhancements

Potential improvements:

* OAuth login (Google, GitHub)
* SAML SSO
* WebAuthn / Passkeys
* Session management dashboard
* Audit logging
* device trust management

---

# Responsibilities of Auth Service

The auth service manages:

* user identity
* authentication
* token issuance
* tenant role assignment
* API keys
* authorization permissions

All platform requests must be authenticated using tokens issued by this service.

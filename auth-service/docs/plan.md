# Auth Service Development Plan

## Overview

Build a production-ready authentication and authorization microservice from scratch using NestJS, following the technical specification. The service handles user identity, JWT token issuance, multi-tenant RBAC, and integrates with PostgreSQL, Redis, and Kafka.

**Current State**: Greenfield project - only specification document exists
**Target**: Fully functional, containerized auth service with comprehensive security features

---

## Phase 1: Foundation & Project Setup

**Goal**: Initialize NestJS project with TypeScript, configure basic structure

**Steps**:

1. Initialize NestJS project using CLI (`nest new auth-service`)
2. Configure TypeScript (tsconfig.json) with strict mode
3. Install core dependencies: @nestjs/jwt, @nestjs/passport, passport, passport-jwt
4. Install security dependencies: bcrypt/argon2, helmet, @nestjs/throttler
5. Set up environment configuration using @nestjs/config
6. Create basic module structure: auth, users, roles, permissions, tokens, api-keys modules
7. Configure .env.example and .gitignore files
8. Set up ESLint and Prettier for code quality

**Deliverables**: Working NestJS application that starts successfully

---

## Phase 2: Database Layer Setup

**Goal**: Configure PostgreSQL with Prisma ORM, define complete schema

**Steps**:

1. Install Prisma: `npm install prisma @prisma/client`
2. Initialize Prisma: `npx prisma init`
3. Define complete schema in `prisma/schema.prisma`:
   - users table (with status, email verification)
   - roles table
   - permissions table
   - role_permissions junction table
   - user_roles junction table (multi-tenant)
   - refresh_tokens table (with revoked flag)
   - email_verifications table
   - password_resets table
   - api_keys table
4. Configure database URL in .env for PostgreSQL connection
5. Generate Prisma Client: `npx prisma generate`
6. Create initial migration: `npx prisma migrate dev --name init`
7. Create PrismaService and PrismaModule in NestJS
8. Implement repository pattern or service layer for database access

**Deliverables**: Complete database schema, Prisma Client integrated with NestJS

---

## Phase 3: User Management Module

**Goal**: Implement user CRUD operations, password hashing, user status management

**Steps**:

1. Create UsersModule with UsersService and UsersController
2. Implement password hashing utility using bcrypt/argon2
3. Implement user registration endpoint (POST /auth/register):
   - Validate email uniqueness
   - Hash password
   - Create user with PENDING_VERIFICATION status
   - Store user in database
4. Create DTOs for user registration (with class-validator)
5. Implement user lookup methods (findByEmail, findById)
6. Create basic user profile endpoint (GET /auth/me) - will need authentication guard later
7. Implement user status management (ACTIVE, SUSPENDED, PENDING_VERIFICATION)

**Deliverables**: User registration works, passwords are securely hashed

---

## Phase 4: JWT Authentication Core

**Goal**: Implement JWT token generation, login flow, JWT strategy

**Steps**:

1. Generate RSA key pair for RS256 signing (private/public keys)
2. Configure JwtModule with RS256 algorithm in AuthModule
3. Implement AuthService with login method:
   - Validate email/password
   - Generate access token (15 min expiry) with payload: userId, tenantId, roles, permissions
   - Return tokens to client
4. Create JWT Strategy (passport-jwt) for validating access tokens
5. Create JwtAuthGuard to protect routes
6. Implement login endpoint (POST /auth/login)
7. Add validation for user status (only ACTIVE users can login)
8. Create token payload builder utility

**Deliverables**: Users can login and receive JWT access tokens, protected routes work

---

## Phase 5: Refresh Token System

**Goal**: Implement refresh token generation, storage, validation, and rotation

**Steps**:

1. Create TokensModule with TokensService
2. Implement refresh token generation:
   - Generate cryptographically secure random token
   - Hash token before storing in database
   - Set 7-30 day expiry
3. Modify login flow to return both access + refresh tokens
4. Implement token refresh endpoint (POST /auth/refresh):
   - Validate refresh token (check hash, expiry, not revoked)
   - Generate new access token
   - Optionally rotate refresh token (depends on configuration decision)
5. Create RefreshTokenGuard using passport-jwt
6. Implement logout endpoint (POST /auth/logout):
   - Mark refresh token as revoked
   - Clean up session

**Deliverables**: Full token lifecycle working - login, refresh, logout

---

## Phase 6: Email Verification System

**Goal**: Implement email verification tokens and verification flow

**Steps**:

1. Modify registration flow to generate email verification token
2. Store verification token hash in email_verifications table with expiry
3. Create verification endpoint (POST /auth/verify-email?token=xxx)
4. Update user status to ACTIVE upon successful verification
5. Add check in login to prevent unverified users from logging in (configurable)
6. Implement token expiry validation and cleanup

**Deliverables**: Users receive verification tokens, can verify email, status updated

**Note**: Email sending is delegated to notification-service via Kafka (Phase 8)

---

## Phase 7: Password Reset Flow

**Goal**: Implement forgot password and reset password functionality

**Steps**:

1. Create forgot password endpoint (POST /auth/forgot-password):
   - Validate email exists
   - Generate password reset token
   - Hash and store in password_resets table with expiry
   - Publish event to Kafka (Phase 8 dependency)
2. Create reset password endpoint (POST /auth/reset-password):
   - Validate token (hash, expiry)
   - Update user password with new hash
   - Invalidate token after use
   - Publish password changed event
3. Add rate limiting specifically for forgot password endpoint

**Deliverables**: Complete password reset flow functional

---

## Phase 8: Role-Based Access Control (RBAC)

**Goal**: Implement multi-tenant roles, permissions, and authorization guards

**Steps**:

1. Create RolesModule and PermissionsModule
2. Seed initial roles: owner, admin, manager, staff
3. Seed permissions based on spec examples (inventory.read, order.create, etc.)
4. Create role-permission mappings in database
5. Implement user role assignment per tenant (user_roles table)
6. Create authorization guards:
   - RolesGuard (@Roles decorator)
   - PermissionsGuard (@RequirePermissions decorator)
7. Modify JWT payload generation to include roles and permissions for user's tenant
8. Implement tenant context extraction from request
9. Create endpoints for role/permission management (admin only)

**Deliverables**: RBAC system fully functional, routes can be protected by roles/permissions

---

## Phase 9: Security Hardening

**Goal**: Implement comprehensive security measures

**Steps** (_can be done in parallel with previous phases_):

1. Configure Helmet middleware for secure HTTP headers
2. Implement rate limiting using @nestjs/throttler:
   - Global rate limiting
   - Stricter limits for login endpoint
   - Custom brute force protection for failed login attempts
3. Configure CORS restrictions
4. Implement password policy validation (complexity, length)
5. Add request validation using class-validator globally
6. Implement input sanitization
7. Configure security headers (CSP, HSTS, etc.)
8. Add IP logging for login attempts (optional)
9. Implement account lockout after N failed attempts

**Deliverables**: Service hardened against common attacks

---

## Phase 10: Kafka Event Publishing

**Goal**: Integrate Kafka producer for publishing auth events

**Steps**:

1. Install KafkaJS or @nestjs/microservices with Kafka transport
2. Create EventsModule with KafkaProducerService
3. Configure Kafka broker connection in .env
4. Implement event publishing for:
   - user.created (on registration)
   - user.login (on successful login)
   - user.invited (if implementing invitation flow)
   - user.password.changed (on password reset)
   - user.email.verified (on verification)
5. Add event schema validation
6. Update existing flows to publish events at appropriate points
7. Add error handling and retry logic for failed publishes

**Deliverables**: Auth events published to Kafka topics, consumers can receive them

---

## Phase 11: Redis Caching Layer

**Goal**: Integrate Redis for session management and caching

**Steps**:

1. Install redis and @nestjs/cache-manager
2. Configure Redis connection in .env
3. Implement caching strategies:
   - Cache user permissions/roles for faster authorization
   - Cache active sessions (optional)
   - Store rate limiting counters in Redis
4. Create RedisModule and RedisService
5. Implement cache invalidation on user/role updates
6. Add TTL configuration for different cache types

**Deliverables**: Redis integrated, performance improved for authorization checks

---

## Phase 12: API Keys Management

**Goal**: Implement API key generation and validation for server-to-server auth

**Steps**:

1. Create ApiKeysModule with ApiKeysService and ApiKeysController
2. Implement API key generation endpoint (POST /api-keys):
   - Generate cryptographically secure key
   - Hash before storing
   - Associate with tenant
   - Set optional expiry
3. Create ApiKeyStrategy for passport
4. Create ApiKeyGuard for protecting routes
5. Implement API key validation middleware
6. Add endpoints for listing, revoking API keys
7. Implement key rotation functionality

**Deliverables**: API keys can be generated, used for authentication, managed

---

## Phase 13: Swagger API Documentation

**Goal**: Generate comprehensive API documentation

**Steps** (_can be done in parallel_):

1. Install @nestjs/swagger
2. Configure Swagger module in main.ts
3. Add @ApiTags decorators to controllers
4. Add @ApiOperation, @ApiResponse decorators to endpoints
5. Document DTOs with @ApiProperty
6. Add authentication schemes to Swagger (Bearer token, API key)
7. Generate OpenAPI spec file
8. Add example payloads for all requests/responses

**Deliverables**: Complete API documentation accessible at /api/docs

---

## Phase 14: Containerization

**Goal**: Create Docker configuration for service and dependencies

**Steps**:

1. Create Dockerfile for auth-service:
   - Multi-stage build (build + production)
   - Optimize for small image size
   - Non-root user for security
2. Create docker-compose.yml including:
   - auth-service
   - PostgreSQL database
   - Redis cache
   - Kafka + Zookeeper
3. Configure health check endpoints
4. Add volume mounts for development
5. Create separate docker-compose.dev.yml for development
6. Document Docker commands in README

**Deliverables**: Service runs in Docker, all dependencies containerized

---

## Phase 15: Testing & Quality Assurance

**Goal**: Implement comprehensive test coverage

**Steps**:

1. Set up Jest testing framework (comes with NestJS)
2. Write unit tests for:
   - AuthService (login, token generation)
   - UsersService (registration, password hashing)
   - TokensService (refresh token validation)
   - Guards (JWT, Roles, Permissions)
3. Write integration tests for:
   - Complete auth flows (register → verify → login → refresh → logout)
   - RBAC authorization
   - Password reset flow
4. Write E2E tests for critical API endpoints
5. Set up test database configuration
6. Achieve target code coverage (>80%)
7. Add pre-commit hooks for running tests

**Deliverables**: Comprehensive test suite, CI-ready

---

## Phase 16: Advanced Features (Optional Enhancements)

**Goal**: Implement future enhancements from specification

**Steps** (_pick based on priorities_):

1. **2FA/TOTP**:
   - Install speakeasy or otplib
   - Add 2FA setup endpoint
   - Modify login to verify TOTP
   - Store 2FA secrets encrypted
2. **OAuth Integration** (Google, GitHub):
   - Install passport-google-oauth20, passport-github
   - Add OAuth strategies
   - Create OAuth callback endpoints
   - Link OAuth accounts to users
3. **Device Tracking**:
   - Store device information on login
   - Add trusted device management
   - Implement device approval flow
4. **Session Management Dashboard**:
   - Endpoint to list active sessions
   - Ability to revoke specific sessions
   - View login history
5. **Audit Logging**:
   - Create audit_logs table
   - Log all security-relevant actions
   - Queryable audit trail
6. **WebAuthn/Passkeys**:
   - Install @simplewebauthn/server
   - Implement registration/authentication ceremonies

**Deliverables**: Selected advanced features implemented and tested

---

## Verification Steps

After each phase:

1. Run `npm run build` - ensure no compilation errors
2. Run `npm run test` - all tests pass
3. Run `npm run start:dev` - service starts without errors
4. Test new endpoints using Postman/Thunder Client/curl
5. Verify database schema changes with `npx prisma studio`
6. Check Kafka topics using kafka-console-consumer (Phase 10+)
7. Verify Redis entries using redis-cli (Phase 11+)
8. Run docker-compose up and verify all containers healthy (Phase 14+)

**Final Verification**:

1. Complete end-to-end auth flow succeeds
2. All RBAC rules enforced correctly
3. Security headers present in responses
4. Rate limiting triggers as expected
5. All Kafka events publishing successfully
6. API documentation accurate and complete
7. Docker deployment works in production-like environment

---

## Critical Files to Create

- `/package.json` - dependencies
- `/tsconfig.json` - TypeScript config
- `/nest-cli.json` - NestJS config
- `/.env.example` - environment template
- `/src/main.ts` - application entry point
- `/src/app.module.ts` - root module
- `/src/modules/auth/` - authentication module
- `/src/modules/users/` - user management
- `/src/modules/roles/` - role management
- `/src/modules/permissions/` - permissions
- `/src/modules/tokens/` - token management
- `/src/modules/api-keys/` - API key management
- `/src/modules/events/` - Kafka integration
- `/src/guards/` - authorization guards
- `/src/strategies/` - passport strategies
- `/src/decorators/` - custom decorators (@Roles, @Permissions)
- `/src/common/` - shared utilities
- `/prisma/schema.prisma` - database schema
- `/Dockerfile` - container configuration
- `/docker-compose.yml` - multi-container setup
- `/keys/` - RSA key pair for JWT signing (gitignored)

---

## Scope Boundaries

**Included**:

- Complete authentication system (JWT + refresh tokens)
- User registration, login, logout
- Email verification and password reset flows
- Multi-tenant RBAC with roles and permissions
- API key management
- Kafka event publishing
- Redis caching
- Security hardening (rate limiting, helmet, etc.)
- Docker containerization
- Swagger documentation
- Comprehensive testing

**Excluded** (external dependencies):

- Email sending (handled by notification-service)
- Frontend application
- API Gateway / reverse proxy configuration
- Production deployment orchestration (K8s manifests)
- Monitoring/observability setup (Prometheus, Grafana)
- Log aggregation (ELK stack)
- Backup/restore procedures

**Optional** (Phase 16):

- 2FA/TOTP
- OAuth social login
- Device tracking and trust
- Session management UI
- WebAuthn support
- Advanced audit logging

---

## Phase 8.5: Tenant-Aware Auth Refactor (Tenant-Service Absorption)

**Goal**: Make tenancy explicit and first-class inside auth-service — absorbing all responsibilities of a hypothetical tenant-service — without breaking existing RBAC design.

> 🧠 "You already built 70% of multi-tenancy — now make it explicit and clean."

**Design rules**:

- `user_roles` remains the **source of truth** for tenant membership AND role assignment — no new "membership" table
- Guards MUST NOT make DB calls — rely only on JWT payload
- Existing login/signup must continue to work; this phase only EXTENDS them

---

### Step 1: Schema — Tenant model + user_roles integrity

**Explicit `Tenant` model** (already exists in schema; ensure it has `slug`):

```prisma
model Tenant {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
}
```

**`user_roles` must contain `tenant_id`** (already present):

```prisma
model UserRole {
  user_id    String
  role_id    String
  tenant_id  String        // ← source of both membership + role scoping
  created_at DateTime @default(now())
  @@unique([user_id, role_id, tenant_id])
}
```

**`Roles` must be tenant-scoped** (already done in Phase 8):

```prisma
model Roles {
  tenant_id  String
  name       String
  @@unique([name, tenant_id])
}
```

Migration strategy for existing data:

1. If `Roles.tenant_id` is missing → backfill with a "system" default tenant id
2. If `UserRole.tenant_id` is missing rows → backfill same default tenant

---

### Step 2: Signup flow extension

**Current**: creates user  
**New** (additive only):

1. Create user (existing)
2. `CREATE` a new `Tenant` with a generated slug (`{name}-{cuid}`)
3. `UPSERT` a default `Roles` row `{ name: 'owner', tenant_id }` if not exists
4. Insert into `user_roles`: `{ user_id, role_id: ownerRole.id, tenant_id }`

No existing signup logic is removed.

---

### Step 3: Login flow — auto tenant selection

**Current**: login → JWT (optional tenant_id from body)  
**New**:

1. Validate user credentials (existing)
2. If `tenant_id` provided in body → use it
3. Else → fetch the user's first `user_roles` row and use that `tenant_id` (default tenant)
4. Build JWT payload with tenant-scoped RBAC:

```json
{
  "sub": "userId",
  "tenant_id": "tenantId",
  "roles": ["owner"],
  "permissions": ["inventory.read", "order.create"]
}
```

---

### Step 4: Tenant Switching — `POST /auth/switch-tenant`

Input: `{ tenantId: string }`  
Logic:

1. Verify a `user_roles` row exists for `{ user_id, tenant_id }`
2. Fetch roles + permissions for that tenant (via `findUserRolesAndPermissions`)
3. Issue a **new JWT** with the new tenant context
4. Return `{ accessToken, refreshToken }` (rotated)

---

### Step 5: Guard alignment (already correct after Phase 8)

- `RolesGuard` → reads `JWT.roles` → no DB calls ✅
- `PermissionsGuard` → reads `JWT.permissions` → no DB calls ✅
- Tenant context is encoded in `JWT.tenant_id` ✅

No guard changes needed if Phase 8 was implemented correctly.

---

### Step 6: Tenants module + API additions

New `TenantsModule` with endpoints (do NOT modify existing endpoints):

- `POST /tenants` — create a standalone tenant (admin use)
- `GET /tenants/me` — list all tenants the calling user belongs to (query `user_roles` by `user_id`)

---

### Step 7: (Bonus) Tenant context middleware

Add lightweight `TenantContextMiddleware`:

- Reads `tenant_id` from the decoded JWT
- Sets it on `request.tenantId` for use in downstream controllers/services

---

**Deliverables**:

- Auth service fully owns tenant lifecycle
- Signup auto-creates tenant + owner role
- Login defaults tenant if none provided
- `POST /auth/switch-tenant` issues new JWT for a different tenant
- RBAC remains intact and tenant-scoped
- Other services can trust `JWT.tenant_id` as the canonical tenant context

**Phase 8.5** depends on Phase 8 (RBAC must be in place)

---

## Key Technical Decisions

1. **Password Hashing**: Use argon2 (more secure) vs bcrypt (more widely adopted) - **Recommend argon2**
2. **Refresh Token Rotation**: Implement automatic rotation on refresh vs keep same token - **Recommend rotation for security**
3. **Email Verification Required**: Block login until verified vs allow login with limited access - **Recommend blocking login**
4. **Multi-tenancy**: Store tenantId in JWT payload vs separate authentication per tenant - **Use JWT payload as per spec**
5. **JWT Signing**: RS256 (asymmetric) as specified is correct for microservices architecture
6. **Token Storage**: Store refresh tokens hashed (as per spec) - correct security practice
7. **Database Migrations**: Use Prisma Migrate for version-controlled schema changes

---

## Dependencies Between Phases

- **Phase 3** depends on Phase 2 (database must exist for user storage)
- **Phase 4** depends on Phase 3 (need users for authentication)
- **Phase 5** depends on Phase 4 (refresh tokens extend JWT auth)
- **Phase 6** depends on Phase 3 (modifies user registration)
- **Phase 7** depends on Phase 3 (password management needs users)
- **Phase 8** depends on Phase 2, 4 (RBAC needs database and JWT)
- **Phase 10** depends on Phases 3, 4, 6, 7 (publishes events from these flows)
- **Phase 11** can happen in parallel with 8-10
- **Phase 12** depends on Phase 2, 8 (needs database and RBAC)
- **Phase 13** can happen in parallel with any phase
- **Phase 14** depends on all core phases (1-12)
- **Phase 15** should happen continuously alongside development
- **Phase 9** (Security) can be implemented incrementally throughout

**Parallelization Opportunities**:

- Phases 9, 13 can be done in parallel with functional development
- Phase 15 (testing) should be done incrementally per phase
- Phase 11 (Redis) can be done while working on Phase 8-10

---

## Estimated Complexity

- **Phase 1**: 1-2 days (project setup)
- **Phase 2**: 2-3 days (database design and setup)
- **Phase 3**: 2-3 days (user management)
- **Phase 4**: 3-4 days (JWT implementation)
- **Phase 5**: 2-3 days (refresh tokens)
- **Phase 6**: 1-2 days (email verification)
- **Phase 7**: 1-2 days (password reset)
- **Phase 8**: 4-5 days (RBAC - most complex)
- **Phase 9**: 2-3 days (security hardening)
- **Phase 10**: 2-3 days (Kafka integration)
- **Phase 11**: 2 days (Redis caching)
- **Phase 12**: 2-3 days (API keys)
- **Phase 13**: 1-2 days (documentation)
- **Phase 14**: 2-3 days (Docker setup)
- **Phase 15**: 5-7 days (comprehensive testing)
- **Phase 16**: Variable (per feature)

**Total**: Approximately 6-8 weeks for core implementation + testing

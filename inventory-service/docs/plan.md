# Inventory Service Development Plan

## Overview

Build the inventory microservice using NestJS, following the technical specification. The service owns the product catalog, variants, barcodes, locations and stock ledger for every tenant, with a JSON-Schema-driven flexible data model so that any kind of product can be stored without migrations.

**Current State**: Phases 1–6 are done, the HTTP e2e suite passes (35 checks), and the web UI under `/inventory` is wired. Kafka (7), Swagger (8), Docker (9) and unit/integration tests (10) remain.
**Target**: Containerized inventory service with validated flexible attributes, transactional stock movements, and Kafka events

---

## Phase 1: Foundation & Project Setup (done)

**Goal**: Initialize NestJS project inside the existing `inventory-service` workspace

**Steps**:

1. Initialize NestJS in place (`nest new` into a temp dir and copy, or scaffold manually) — keep the existing `package.json` scripts and `prisma/` folder
2. Extend `../tsconfig.base.json`; copy `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, ESLint/Prettier config from `auth-service`
3. Install core deps: `@nestjs/common`, `@nestjs/core`, `@nestjs/config`, `@nestjs/platform-express`, `@nestjs/microservices`, `@grpc/grpc-js`, `@grpc/proto-loader`, `class-validator`, `class-transformer`, `helmet`, `ajv`, `ajv-formats`
4. ~~Add `Dockerfile` and `docker-compose.yml`~~ — moved to Phase 9
5. Register Nx targets (`build`, `test`, `lint`, `start:dev`, `prisma:generate`) — add `start:inventory:dev` to the root `package.json`
6. Run `npm install` at the root so the workspace is linked

**Deliverables**: `nx run inventory-service:start:dev` boots an empty app

---

## Phase 2: Database Layer (done)

**Goal**: Wire Prisma to the shared Postgres instance using the `inventory` schema

**Steps**:

1. Copy `src/prisma/connection-config.ts` from auth-service unchanged
2. Create `PrismaService` — identical to auth-service except `new PrismaPg(config, { schema: 'inventory' })`
3. Set `DATABASE_URL` in `.env` with `?schema=inventory` (same host/database as auth-service)
4. `npx prisma migrate dev --name init` — confirm it creates the `inventory` schema and `inventory._prisma_migrations`, and does **not** touch `public.*`
5. Run auth-service's `prisma migrate status` afterwards to confirm it still reports clean
6. `npx prisma generate`; confirm `generated/prisma` is gitignored

**Deliverables**: Migration applied; both services' migration histories independent

---

## Phase 3: Auth Integration (done)

**Goal**: Protect every route with auth-service-issued JWTs and RBAC permissions

**Decision**: verify tokens locally with auth-service's RS256 public key instead of the gRPC `ValidateToken`. The proto returns one role and no permissions, so it can't feed the permission guard, and it saves a network hop per request.

**Steps**:

1. `AuthModule` registers `JwtModule` with `JWT_PUBLIC_KEY_PATH` (default `../auth-service/keys/public.pem`)
2. `JwtAuthGuard` verifies the Bearer token and **requires `tenant_id`** (403 otherwise)
3. `PermissionsGuard` + `@RequirePermissions()`; `owner` / `admin` roles bypass because auth-service seeds no permission rows yet
4. `@Tenant()` param decorator — **the only source of `tenant_id` in the service**
5. `@Protected(perm)` combines both guards on every route

**Deliverables**: Unauthenticated requests get 401; missing permission gets 403

---

## Phase 4: Variant Types & JSON Schema Validation (done)

**Goal**: Tenants define what their variants look like and which field splits stock; products stay free-form

**Steps**:

1. `VariantTypesModule` — CRUD on `variant_types`: `attribute_schema` for the variant's fields plus `axis_key`, the one field (text or choice) whose values are priced and stocked separately; null for a single unit. Product types were dropped — they coupled "what kind of product" to "how it is stocked", which is the variant's business
2. Validate that `attribute_schema` is itself valid JSON Schema (Ajv `validateSchema`) and that `axis_key` is one of its string fields
3. `JsonSchemaValidator` in `common/` — compiles schemas with Ajv and caches by `(type_id, updated_at, axis_key)`; the axis field is stripped from the schema before variant attributes are checked
4. `GET /variant-types/:id/violations` — re-validate existing variants (attributes, and sizes against the axis field's choices) and report mismatches; edits never block on existing data
5. Every response spells the axis out (`axis_label`, `axis_values`, `axis_free`) so clients don't parse the schema
6. Variants may be untyped, in which case `attributes` accepts anything and sizes are free text
7. Reject deletion of a type that is in use

**Deliverables**: A tenant can create the `sized-apparel` / `bottled` / `single` variant types from the spec example and get validation errors on bad attributes or sizes

---

## Phase 5: Catalog — Categories, Products, Variants, Sizes, Barcodes (done)

**Goal**: Full CRUD for the catalog with flexible attributes, in the legacy shape: Product → named Variant → Sizes

**Steps**:

1. `CategoriesModule` — tree CRUD; block delete when children or products exist
2. `ProductsModule`:
   - Create with nested `variants[]` (≥ 1), each with its own `variant_type_id`, `attributes` and `sizes[]`
   - Product `attributes` are free-form; each variant's `attributes` are validated against **its** variant type; size labels against the axis field's choices when it has any; single-unit types get one `Default` size
   - Soft delete (`deleted_at`) cascading to variants and sizes; all reads filter `deleted_at IS NULL`
   - List with filters: `q` (name/code/variant name/SKU/barcode), `status`, `type`, `category`, `tag`, and `attr[key]=value` (Prisma `path`/`equals` JSON filter for now; switching to `attributes @> '{...}'` via raw SQL to use the GIN index is a follow-up if lists get slow)
   - Stock totals aggregated per size → per variant → per product
3. `VariantsModule`:
   - Variant CRUD (name unique per product; type change re-checks live sizes; last variant cannot be removed)
   - Size CRUD under a variant (`POST /variants/:id/sizes`, `PATCH|DELETE /sizes/:id`; last size cannot be removed; prices optional, `null` clears)
   - `GET /sizes/lookup?barcode=` — resolve via `barcodes` table to the size, its variant and product
4. Barcodes — add/remove codes on a size; enforce one `is_primary` per size
5. DTOs with class-validator for the promoted columns; `attributes` typed as `Record<string, unknown>` and validated by Ajv in the service layer

**Deliverables**: Garment tenant can recreate the legacy `Products`/`Variants`/sizes data via the API (the e2e test does exactly this, mixing a sized variant and a single-unit pack under one product)

---

## Phase 6: Locations & Stock Ledger (done)

**Goal**: Transactional stock movements with an immutable ledger

**Steps**:

1. `LocationsModule` — tree CRUD; seed an `is_default` location per tenant; block delete when children or non-zero stock exist
2. `StockModule`:
   - `POST /stock/movements` accepting `IN | OUT | ADJUST | TRANSFER`
   - Validate required locations per type (see spec)
   - Single `prisma.$transaction`: lock the affected `stock_levels` rows (`SELECT … FOR UPDATE` via `$queryRaw`), apply delta(s), insert the movement
   - `OUT` fails with 409 when `quantity - reserved < requested` (tenant-level `allow_negative` override later)
   - `ADJUST` accepts `counted` and computes the delta; stores `payload.previous` / `payload.counted`
3. `POST /stock/reserve` / `POST /stock/release` — adjust `reserved` only; no ledger row
4. `GET /variants/:id/stock` — per-location rows + total
5. `GET /stock?below_reorder=true` — `quantity < reorder_at`
6. Movements are never updated or deleted; no PATCH/DELETE routes exist

**Deliverables**: Concurrent OUT requests for the last unit cannot both succeed

---

## Phase 7: Kafka Events

**Goal**: Notify the platform of catalog and stock changes

**Steps**:

1. `EventsModule` with a Kafka producer (same client setup as auth-service)
2. Publish `inventory.product.*`, `inventory.variant.*` after successful writes
3. Publish `inventory.stock.changed` after every movement commit, carrying the new balance
4. Publish `inventory.stock.low` when a movement crosses `quantity` below `reorder_at`
5. Publish **after** the transaction commits; on producer failure, log and continue (outbox table is a later enhancement)

**Deliverables**: notification-service can subscribe to low-stock alerts

---

## Phase 8: Swagger Documentation

**Goal**: Browsable API docs at `/docs`

**Steps**:

1. `@nestjs/swagger` setup mirroring auth-service
2. Decorate DTOs; document `attributes` / `options` as free-form objects with a link to the product type
3. Document the `attr[key]=value` filter syntax

**Deliverables**: `/docs` served in non-production environments

---

## Phase 9: Containerization

**Goal**: Independent deployable image

**Steps**:

1. Multi-stage `Dockerfile` (build → prune → runtime), `prisma generate` at build time
2. `docker-compose.yml` for local dev pointing at the shared Postgres container from auth-service
3. Entry script runs `prisma migrate deploy` before `node dist/src/main`
4. Health endpoint `GET /health` checking DB connectivity

**Deliverables**: `docker compose up` brings up the service against the shared DB

---

## Phase 10: Testing (HTTP e2e done; unit and integration pending)

**Goal**: Confidence in the two risky areas — schema validation and stock concurrency

**Steps**:

1. Unit tests: `JsonSchemaValidator`, movement validation rules, delta computation for `ADJUST`
2. Integration tests (real Postgres, `inventory_test` schema): product create with nested variants, `attr[]` filtering hits the GIN index (`EXPLAIN`), barcode lookup
3. Concurrency test: 10 parallel `OUT` requests for a variant with `quantity = 1` — exactly one succeeds
4. Migration isolation test: run both services' `migrate status` against one database
5. E2E script (`test/inventory-e2e.js`) in the style of `auth-service/test/passkey-e2e.js`: create type → product → variants → receive → transfer → issue → assert ledger

**Deliverables**: `nx run inventory-service:test` green

---

## Phase 11: Advanced Features (Optional)

* Batch/lot + expiry (`stock_levels` gains nullable `lot_id`; ledger carries it)
* Serial-number tracking table
* CSV bulk import with per-row validation report
* Transactional outbox for Kafka
* Redis cache for compiled JSON Schemas and barcode lookups
* Full-text search on `name` + `attributes`

---

## Verification Steps

1. `prisma validate` passes; `prisma migrate dev` creates only `inventory.*` objects
2. auth-service `prisma migrate status` unaffected
3. Garment example from the spec: create type, product with `hsn`, three size variants, EAN barcodes; `GET /variants/lookup?barcode=` resolves
4. Bad `attributes` (missing `hsn`) rejected with a 400 that names the JSON Schema path
5. Receive 10 → transfer 4 → issue 7 fails (only 6 at source) → issue 6 succeeds; ledger has 3 rows, levels sum to 4
6. Kafka topic shows `inventory.stock.changed` for each commit

---

## Critical Files to Create

```
inventory-service/
 ├ src/main.ts
 ├ src/app.module.ts
 ├ src/prisma/prisma.service.ts           ← adapter with { schema: 'inventory' }
 ├ src/prisma/connection-config.ts        ← copy from auth-service
 ├ src/common/json-schema.validator.ts
 ├ src/common/tenant.decorator.ts
 ├ src/guards/jwt-auth.guard.ts
 ├ src/guards/permissions.guard.ts
 ├ src/modules/categories/…
 ├ src/modules/products/…
 ├ src/modules/variants/…
 ├ src/modules/barcodes/…
 ├ src/modules/locations/…
 ├ src/modules/stock/…
 ├ src/modules/events/…
 ├ test/inventory-e2e.js
 ├ Dockerfile
 └ docker-compose.yml
```

---

## Scope Boundaries

**In scope**: catalog, variants, barcodes, locations, stock levels, movement ledger, reservations, stock events.

**Out of scope** (other services): orders and pricing rules (transaction-service), suppliers and purchase orders (vendor-service), customers (customer-service), users/tenants/roles (auth-service). This service stores only string references to those.

---

## Key Technical Decisions

1. **jsonb + per-tenant JSON Schema** instead of EAV tables or per-tenant migrations — validated at the API layer, indexed with GIN `jsonb_path_ops`
2. **`attributes` vs `metadata`** — tenant data and service bookkeeping in separate columns so keys never collide
3. **Stock lives on `stock_levels`, keyed by size, never on variants** — one source of truth; totals are aggregated per variant and product
3a. **Only variants are typed** — a product is free-form; each variant picks a variant type, and one of that type's own fields (any name: Size, Capacity, Pack…) is the axis that splits stock. Nothing industry-specific is hardcoded
4. **Ledger is append-only** — corrections are new `ADJUST` rows
5. **Location is required on stock** — nullable FKs break Postgres unique constraints; a default location is seeded per tenant instead
6. **Shared Postgres instance, separate schema** — `?schema=inventory` for the CLI, `{ schema: 'inventory' }` for the adapter; no cross-schema FKs
7. **No FKs to other services** — `tenant_id`, `supplier_id`, `actor_id` are plain strings

---

## Dependencies Between Phases

```
1 → 2 → 3 → 4 → 5 → 6 → 7
                     ↘ 8
              9 after 6
             10 after 7
```

Phases 4–5 can be built against a stub guard while Phase 3 is in progress, but must not merge without it.

---

## Estimated Complexity

| Phase | Complexity | Notes |
| --- | --- | --- |
| 1–2 | Low | Copy from auth-service |
| 3 | Low–Medium | gRPC client + guards |
| 4 | Medium | Ajv integration, schema caching |
| 5 | Medium | Nested create, `attr[]` filter translation |
| 6 | **High** | Row locking, multi-row transactions, invariants |
| 7 | Low | Producer only |
| 8–9 | Low | Mirrors auth-service |
| 10 | Medium | Concurrency test needs a real DB |

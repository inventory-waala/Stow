# API Gateway

This is a lightweight Express-based API Gateway for the inventory monorepo. It proxies incoming requests to backend services (auth, inventory, products, etc.) and provides a central place for cross-cutting concerns like CORS, security headers, logging, and health checks.

Quick start

1. Install dependencies from the workspace root (or run inside this folder):

```powershell
cd api-gateway
npm install
npm run start:dev
```

2. Gateway defaults (environment variables):

 - PORT (default 3000)
 - AUTH_HOST, AUTH_PORT (defaults: localhost:3001)
 - INVENTORY_HOST, INVENTORY_PORT (defaults: localhost:3002)
 - PRODUCT_HOST, PRODUCT_PORT (defaults: localhost:3003)

The gateway exposes a simple health endpoint at `/health` and proxies `/auth`, `/inventory`, and `/products` to the configured services. Adjust `src/routes.ts` to match your local docker-compose or service ports.

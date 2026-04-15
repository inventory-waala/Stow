# Inventory Waala Monorepo

This workspace now uses a monorepo-oriented layout with a root workspace definition and shared tooling.

## What changed

- Added a root `package.json` with npm workspaces.
- Added root scripts to run `build`, `lint`, `test`, and `format` across all workspace packages.
- Added a shared `tsconfig.base.json` for TypeScript services.
- Added a root `.gitignore` for common generated files.

## Current workspace packages

Any folder matched by the workspace patterns and containing a `package.json` is included automatically.

Today, `auth-service` is the active package with full Node/Nest setup.

## Run commands from root

```bash
npm install
npm run build
npm run test
npm run start:auth:dev
```

## Migration path for each service

For each service folder you want managed by this monorepo:

1. Add a `package.json` in that service folder.
2. Add service-specific scripts (`build`, `lint`, `test`, etc.).
3. If TypeScript-based, set service `tsconfig.json` to extend `../tsconfig.base.json`.
4. Run root-level commands to execute scripts across all services.

## Git note

Several service folders currently contain their own `.git` directories. This setup can coexist while migrating, but a true single-repo Git model usually requires consolidating those repositories into one root repository when you are ready.

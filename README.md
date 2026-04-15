# Inventory Monorepo

This repository uses a monorepo layout for development consistency, while deployment remains microservice based.

## Architecture model

- Monorepo for source control, dependency orchestration, and shared developer workflows.
- Independent microservice deployment for build, containerization, and runtime.

Each service is deployed separately and owns its own runtime configuration.

## Root responsibilities

The root is used for workspace level orchestration:

- npm workspaces definition
- shared scripts for build, lint, test, and formatting
- shared TypeScript baseline in tsconfig.base.json
- global ignore and repo level documentation

The root is not a deployable service.

## Service responsibilities

Each deployable service should contain its own:

- package.json
- Dockerfile
- environment templates and service config
- service specific build and test scripts

This keeps deployment boundaries clean and supports independent releases.

## Running from root

Use root commands for developer productivity across services:

- npm install
- npm run build
- npm run test
- npm run start:auth:dev

## Deploying services

Deploy per service, not from root.

Typical flow per service:

1. Build and test the service.
2. Build the service Docker image using that service folder context.
3. Push image and deploy through the service specific pipeline.

## Onboarding a new service

1. Create the service folder.
2. Add package.json and service scripts.
3. Add Dockerfile and runtime configuration.
4. If TypeScript based, extend ../tsconfig.base.json.
5. Add CI path filters so only changed services deploy.

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Note: DATABASE_URL must stay in libpq form here (sslmode=require). The CLI
// (migrate, studio) connects through Prisma's engine, which only understands
// libpq sslmode values -- node-postgres extensions like `no-verify` make it
// fail with "Could not load schema metadata". The runtime's stricter TLS needs
// are handled separately in src/prisma/connection-config.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});

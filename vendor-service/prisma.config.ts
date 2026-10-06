import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// DATABASE_URL must stay in libpq form here (sslmode=require); see the note in
// auth-service/prisma.config.ts.
//
// This service shares a database with auth-service and inventory-service but
// owns its own Postgres schema, selected by `?schema=vendor` on the URL. The
// CLI reads that param; the runtime adapter does not, so PrismaService must
// pass it too:
//   new PrismaPg(config, { schema: 'vendor' })
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});

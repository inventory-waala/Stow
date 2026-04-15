import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { ConfigService } from '@nestjs/config';

const configService = new ConfigService();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: configService.get('DATABASE_URL')!,
  },
});

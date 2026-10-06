import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { buildConnectionConfig, isUnverifiedTls } from './connection-config';

/**
 * This service shares a Postgres database with auth-service but owns its own
 * schema. The Prisma CLI reads `?schema=` from DATABASE_URL; the driver
 * adapter does not, so the same name is passed here explicitly. Keep the two
 * in sync or queries will land in `public` and fail with "relation does not
 * exist".
 */
export const DB_SCHEMA = 'vendor';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const config = buildConnectionConfig();
    super({ adapter: new PrismaPg(config, { schema: DB_SCHEMA }) });

    if (isUnverifiedTls(config)) {
      new Logger(PrismaService.name).warn(
        'Database TLS is enabled but the server certificate is NOT verified. ' +
          'Set PGSSLROOTCERT to the RDS CA bundle to enable verification.',
      );
    }
  }

  async onModuleInit() {
    this.logger.log(`Connecting to database (schema "${DB_SCHEMA}")...`);
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }
}

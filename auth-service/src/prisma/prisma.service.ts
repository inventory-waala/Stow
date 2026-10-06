import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { buildConnectionConfig, isUnverifiedTls } from './connection-config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const config = buildConnectionConfig();
    super({ adapter: new PrismaPg(config) });

    if (isUnverifiedTls(config)) {
      new Logger(PrismaService.name).warn(
        'Database TLS is enabled but the server certificate is NOT verified. ' +
          'Set PGSSLROOTCERT to the RDS CA bundle to enable verification.',
      );
    }
  }

  async onModuleInit() {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }
}

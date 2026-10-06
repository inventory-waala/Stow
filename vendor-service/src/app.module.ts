import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InventoryModule } from './inventory/inventory.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', cache: true }),
    ThrottlerModule.forRoot([
      {
        ttl: (Number(process.env.RATE_LIMIT_TTL) || 60) * 1000,
        limit: Number(process.env.RATE_LIMIT_MAX) || 300,
      },
    ]),
    PrismaModule,
    AuthModule,
    InventoryModule,
    SuppliersModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

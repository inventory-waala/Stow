import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { TokensModule } from './modules/tokens/tokens.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { PrismaModule } from './prisma/prisma.module';
import { PasskeyModule } from './modules/passkey/passkey.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { SharedJwtModule } from './shared/shared-jwt.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env`,
      cache: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    TokensModule,
    ApiKeysModule,
    PrismaModule,
    PasskeyModule,
    TenantsModule,
    SharedJwtModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { TokensModule } from '../tokens/tokens.module';
import { AUTH_SERVICE } from './interface/auth.service.interface';

@Module({
  imports: [UsersModule, TokensModule],
  providers: [
    {
      provide: AUTH_SERVICE,
      useClass: AuthService,
    },
  ],
  controllers: [AuthController],
  exports: [AUTH_SERVICE],
})
export class AuthModule {}

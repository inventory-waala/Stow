import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module';
import { AuthGrpcController } from './auth.grpc.controller';

/**
 * AuthGrpcModule
 *
 * Self-contained module that wires the gRPC controller.
 *
 * - JwtService is available globally via SharedJwtModule (@Global), so no
 *   explicit JwtModule import is needed here.
 * - UsersModule exports USERS_SERVICE and USERS_REPOSITORY tokens, which
 *   are injected by AuthGrpcController.
 *
 * This module exports nothing — it is purely a server-side listener.
 */
@Module({
  imports: [UsersModule],
  controllers: [AuthGrpcController],
})
export class AuthGrpcModule {}

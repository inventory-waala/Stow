import { Module } from '@nestjs/common';
import { PasskeyService } from './passkey.service';
import { PasskeyController } from './passkey.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { AUTHENTICATOR_REPOSITORY } from '../../repositories/interfaces/authenticator.repository.interface';
import { AuthenticatorRepository } from '../../repositories/authenticator.repository';
import { USERS_REPOSITORY } from '../../repositories/interfaces/users.repository.interface';
import { UsersRepository } from '../../repositories/users.repository';

@Module({
  imports: [PrismaModule, UsersModule],
  providers: [
    PasskeyService,
    { provide: AUTHENTICATOR_REPOSITORY, useClass: AuthenticatorRepository },
    { provide: USERS_REPOSITORY, useClass: UsersRepository },
  ],
  controllers: [PasskeyController],
})
export class PasskeyModule {}

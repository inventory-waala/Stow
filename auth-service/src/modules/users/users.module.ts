import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TokensModule } from '../tokens/tokens.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { USERS_SERVICE } from './interfaces/users.service.interface';
import { USERS_REPOSITORY } from '../../repositories/interfaces/users.repository.interface';
import { UsersRepository } from '../../repositories/users.repository';

@Module({
  imports: [PrismaModule, TokensModule],
  controllers: [UsersController],
  providers: [
    {
      provide: USERS_SERVICE,
      useClass: UsersService,
    },
    {
      provide: USERS_REPOSITORY,
      useClass: UsersRepository,
    },
  ],
  exports: [USERS_SERVICE, USERS_REPOSITORY],
})
export class UsersModule {}

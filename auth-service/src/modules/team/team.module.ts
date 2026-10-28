import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { TokensModule } from '../tokens/tokens.module';
import { UsersModule } from '../users/users.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [
    PrismaModule,
    PermissionsModule,
    MailModule,
    UsersModule,
    TokensModule,
  ],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}

import { Module } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { TokensController } from './tokens.controller';
import { TOKEN_SERVICE } from './interface/token.service.interface';
import { PrismaModule } from '../../prisma/prisma.module';
import { TOKENS_REPOSITORY } from '../../repositories/interfaces/tokens.repository.interface';
import { TokensRepository } from '../../repositories/tokens.repository';
import { EMAIL_VERIFICATION_REPOSITORY } from '../../repositories/interfaces/email-verification.repository.interface';
import { EmailVerificationRepository } from '../../repositories/email-verification.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: TOKEN_SERVICE,
      useClass: TokensService,
    },
    {
      provide: TOKENS_REPOSITORY,
      useClass: TokensRepository,
    },
    {
      provide: EMAIL_VERIFICATION_REPOSITORY,
      useClass: EmailVerificationRepository,
    },
  ],
  controllers: [TokensController],
  exports: [TOKEN_SERVICE],
})
export class TokensModule {}

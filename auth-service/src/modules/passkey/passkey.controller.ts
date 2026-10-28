import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import {
  AUTH_SERVICE,
  IAuthService,
} from '../auth/interface/auth.service.interface';
import { PasskeyService } from './passkey.service';
import {
  GenerateTransactionOptionsDto,
  PasskeyEmailQueryDto,
  VerifyAuthenticationDto,
  VerifyRegistrationDto,
  VerifyTransactionDto,
} from './dto/passkey.controller.dto';

@Controller('passkeys')
export class PasskeyController {
  constructor(
    private readonly passkeyService: PasskeyService,
    @Inject(AUTH_SERVICE)
    private readonly authService: IAuthService,
  ) {}

  @Get('register/generate-options')
  async generateRegistrationOptions(@Query() query: PasskeyEmailQueryDto) {
    return this.passkeyService.generateRegistrationOptions(query.email);
  }

  @Post('register/verify')
  async verifyRegistration(@Body() body: VerifyRegistrationDto) {
    return this.passkeyService.verifyRegistration(body.email, body.response);
  }

  @Get('authenticate/generate-options')
  async generateAuthenticationOptions(@Query() query: PasskeyEmailQueryDto) {
    return this.passkeyService.generateAuthenticationOptions(query.email);
  }

  @Post('authenticate/verify')
  async verifyAuthentication(@Body() body: VerifyAuthenticationDto) {
    // A verified assertion is a full login: return the profile plus a
    // session so the client can proceed exactly as after a password login.
    const result = await this.passkeyService.verifyAuthentication(
      body.response,
    );
    const tokens = await this.authService.loginWithVerifiedUser(
      result.user!.id,
    );
    return { ...result, ...tokens };
  }

  // --- Transactional (Step-Up) Authentication Endpoints ---

  @Post('transaction/generate-options')
  async generateTransactionOptions(
    @Body() body: GenerateTransactionOptionsDto,
  ) {
    return this.passkeyService.generateTransactionOptions(
      body.userId,
      body.transactionId,
    );
  }

  @Post('transaction/verify')
  async verifyTransaction(@Body() body: VerifyTransactionDto) {
    // Verified against the challenge issued for this specific transaction.
    const verification = await this.passkeyService.verifyTransaction(
      body.response,
      body.transactionId,
    );

    return {
      message: 'Transaction cryptographically verified',
      transactionId: body.transactionId,
      verifiedUserId: verification.user.id,
    };
  }
}

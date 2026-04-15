import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { PasskeyService } from './passkey.service';

@Controller('passkeys')
export class PasskeyController {
  constructor(private readonly passkeyService: PasskeyService) {}

  @Get('register/generate-options')
  async generateRegistrationOptions(@Query('email') email: string) {
    return this.passkeyService.generateRegistrationOptions(email);
  }

  @Post('register/verify')
  async verifyRegistration(
    @Body()
    body: {
      email: string;
      response: RegistrationResponseJSON;
      expectedChallenge: string;
    },
  ) {
    return this.passkeyService.verifyRegistration(
      body.email,
      body.response,
      body.expectedChallenge,
    );
  }

  @Get('authenticate/generate-options')
  async generateAuthenticationOptions(@Query('email') email: string) {
    return this.passkeyService.generateAuthenticationOptions(email);
  }

  @Post('authenticate/verify')
  async verifyAuthentication(
    @Body()
    body: {
      response: AuthenticationResponseJSON;
      expectedChallenge: string;
    },
  ) {
    // Verified user profile is returned on success
    return this.passkeyService.verifyAuthentication(
      body.response,
      body.expectedChallenge,
    );
  }

  // --- Transactional (Step-Up) Authentication Endpoints ---

  @Post('transaction/generate-options')
  async generateTransactionOptions(
    @Body() body: { userId: string; transactionId: string },
  ) {
    return this.passkeyService.generateTransactionOptions(
      body.userId,
      body.transactionId,
    );
  }

  @Post('transaction/verify')
  async verifyTransaction(
    @Body()
    body: {
      response: AuthenticationResponseJSON;
      expectedChallenge: string;
      transactionId: string;
    },
  ) {
    // 1. Verify the passkey signature
    const verification = await this.passkeyService.verifyAuthentication(
      body.response,
      body.expectedChallenge,
    );

    // 2. Here we would typically sign a short-lived "Transaction JWT"
    // For now, we return a success asserting the transaction is cryptographically verified.
    return {
      message: 'Transaction cryptographically verified',
      transactionId: body.transactionId,
      verifiedUserId: verification.user.id,
      // transactionToken: "eyJhbGciOiJIUzI1NiIsInR5c... (e.g. valid for 5 mins)"
    };
  }
}

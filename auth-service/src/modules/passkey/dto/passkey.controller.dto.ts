import { IsEmail, IsObject, IsString } from 'class-validator';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';

export class PasskeyEmailQueryDto {
  @IsEmail()
  email: string;
}

/**
 * The WebAuthn credential payloads are validated as opaque objects: their shape
 * is verified cryptographically by @simplewebauthn/server, and declaring them
 * as plain objects keeps the global whitelisting pipe from stripping the nested
 * fields it needs.
 */
export class VerifyRegistrationDto {
  @IsEmail()
  email: string;

  @IsObject()
  response: RegistrationResponseJSON;
}

export class VerifyAuthenticationDto {
  @IsObject()
  response: AuthenticationResponseJSON;
}

export class GenerateTransactionOptionsDto {
  @IsString()
  userId: string;

  @IsString()
  transactionId: string;
}

export class VerifyTransactionDto {
  @IsObject()
  response: AuthenticationResponseJSON;

  @IsString()
  transactionId: string;
}

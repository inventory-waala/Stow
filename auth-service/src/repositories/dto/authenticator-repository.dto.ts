export interface CreateAuthenticatorDto {
  credentialID: string;
  credentialPublicKey: Buffer;
  counter: bigint;
  credentialDeviceType: string;
  credentialBackedUp: boolean;
  transports?: string;
  userId: string;
}

export interface AuthenticatorProfileDto {
  id: string;
  credentialID: string;
  credentialPublicKey: Buffer;
  counter: bigint;
  credentialDeviceType: string;
  credentialBackedUp: boolean;
  transports: string | null;
  userId: string;
  created_at: Date;
}

import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  role_id: string;
}

export class CreateRoleDto {
  @IsString()
  @Length(2, 32)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Length(2, 32)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class SetRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

export class ChangeMemberRoleDto {
  @IsString()
  role_id: string;
}

export class AcceptInviteDto {
  @IsString()
  token: string;
}

/** Accepting an invitation and creating the account in one step. */
export class AcceptInviteWithRegistrationDto {
  @IsString()
  token: string;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;
}

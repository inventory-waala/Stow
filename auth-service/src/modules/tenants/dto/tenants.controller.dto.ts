import { IsString, IsOptional, Length, MaxLength } from 'class-validator';

export class CreateTenantRequestDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateTenantRequestDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class SwitchTenantDto {
  @IsString()
  tenant_id: string;
}

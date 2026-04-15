import { IsString, IsOptional } from 'class-validator';

export class CreateTenantRequestDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SwitchTenantDto {
  @IsString()
  tenant_id: string;
}

export interface CreateTenantDto {
  name: string;
  description?: string;
}

export interface UpdateTenantDto {
  name?: string;
  description?: string;
}

export interface TenantProfileDto {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

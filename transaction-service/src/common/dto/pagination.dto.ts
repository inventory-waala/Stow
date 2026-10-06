import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

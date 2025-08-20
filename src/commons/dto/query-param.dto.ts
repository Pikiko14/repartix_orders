import { Type } from 'class-transformer';
import { IsString, IsOptional, IsDate } from 'class-validator';

export class QueryParamDto {
  @IsOptional()
  parent_id?: string;

  @IsString()
  @IsOptional()
  page: string;

  @IsString()
  @IsOptional()
  perPage: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  @IsString()
  filters?: string;
}

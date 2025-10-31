import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PerformanceReportDto {
  @IsString()
  @IsOptional()
  parent_id?: string;

  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @IsString()
  @IsOptional()
  courier?: string;
}


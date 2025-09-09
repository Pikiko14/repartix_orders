import { Type } from "class-transformer";
import { IsOptional } from "class-validator";

export class QueryReportDto {
  @IsOptional()
  date?: Date;

  @IsOptional()
  parent_id?: string;

  @IsOptional()
  courier?: string;

  @IsOptional()
  sender?: string;

  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  to?: Date;
}

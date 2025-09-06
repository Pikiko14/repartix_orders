import { IsOptional } from "class-validator";

export class QueryReportDto {
  @IsOptional()
  date?: Date;

  @IsOptional()
  parent_id?: string;

  @IsOptional()
  courier?: string;
}

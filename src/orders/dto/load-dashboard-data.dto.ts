import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class LoadDashboardDataDto {
  @IsDate()
  @Type(() => Date)
  from: Date;

  @IsDate()
  @Type(() => Date)
  to: Date;

  @IsOptional()
  parent_id?: string;

  @IsOptional()
  type_user?: string;

  @IsOptional()
  main_user_id?: string;
}

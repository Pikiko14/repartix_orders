import { StatusEnum } from '../entities/order.entity';
import { IsEnum, IsOptional, IsString } from 'class-validator';
export class UpdateStatusDto {
  @IsString()
  order_reference: string;

  @IsString()
  guide_url: string;

  @IsString()
  parent_id: string;

  @IsEnum(StatusEnum)
  @IsOptional()
  status?: StatusEnum;

  @IsString()
  @IsOptional()
  description?: string;
}

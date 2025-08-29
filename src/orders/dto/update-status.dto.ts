import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StatusEnum } from '../entities/order.entity';

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

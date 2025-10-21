import { IsEnum, IsOptional, IsString } from 'class-validator';
export class UpdateStatusDto {
  @IsString()
  order_reference: string;

  @IsString()
  guide_url: string;

  @IsString()
  parent_id: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  user_request_id?: string;
}

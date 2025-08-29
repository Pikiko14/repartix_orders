import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateNewsDto {
  @IsString()
  @IsOptional()
  order_id: string;

  @IsNotEmpty()
  @IsString()
  description?: string;

  @IsString()
  @IsOptional()
  type_news?: string;

  @IsOptional()
  file?: any;

  @IsOptional()
  @IsString()
  parent_id?: string;

  @IsOptional()
  @IsString()
  resolve_answer?: string;
}

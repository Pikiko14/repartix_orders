import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  methods: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsOptional()
  file?: any;

  @IsOptional()
  @IsString()
  parent_id?: string;

  @IsOptional()
  @IsString()
  order_id?: string;

  @IsString()
  @IsOptional()
  date?: string;

  @IsOptional()
  @IsString()
  user_request_id?: string;
}

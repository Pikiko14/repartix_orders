import { IsArray, IsString } from 'class-validator';

export class GenerateInvoicesDto {
  @IsArray()
  ordersIds: string[];

  @IsString()
  parent_id: string;

  @IsString()
  user_request_id: string;
}


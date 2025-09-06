import { IsOptional, IsArray } from "class-validator";

export class LiquidateOrderDto {
  @IsOptional()
  parent_id?: string;

  @IsOptional()
  @IsArray()
  ordersIds: string[];
}

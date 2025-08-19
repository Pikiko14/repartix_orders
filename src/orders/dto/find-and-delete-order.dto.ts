import { IsString, IsOptional } from "class-validator";

export class FindAndDeleteOrderDto {
  @IsString()
  @IsOptional()
  id: string;

  @IsString()
  @IsOptional()
  parent_id: string;
}

import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDate,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Zone } from './../../../../cities_microservice/src/cities/schemas/cities.schema';

export class CoordsDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

export class ClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordsDto)
  coords?: CoordsDto;
}

export class SenderAddressDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  complement: string;

  @ValidateNested()
  @Type(() => CoordsDto)
  coords: CoordsDto;
}

export class SenderDto {
  @IsString()
  @IsNotEmpty()
  brand_name: string;

  @IsNotEmpty()
  @IsString()
  brand_phone?: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => SenderAddressDto)
  address: SenderAddressDto;
}

export class ProductDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unit_price: number;

  @IsOptional()
  @IsNumber()
  total_price?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;
}

export class CourierDto {
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsOptional()
  @IsString()
  vehicle_type?: string;

  @IsOptional()
  @IsString()
  license_plate?: string;
}

export class PaymentDto {
  @IsString()
  @IsNotEmpty()
  methods: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  date: Date;
}

export class CreateOrderDto {
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  scheduled_date: Date;

  @IsOptional()
  @IsEnum([
    'pending',
    'in_progress',
    'delivered',
    'cancelled',
    'returned',
    'guide-printed',
    'guide-news',
  ])
  status:
    | 'pending'
    | 'in_progress'
    | 'delivered'
    | 'cancelled'
    | 'returned'
    | 'guide-printed'
    | 'guide-news';

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ClientDto)
  client: ClientDto;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => SenderDto)
  sender: SenderDto;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProductDto)
  products: ProductDto[];

  
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CourierDto)
  courier: CourierDto;

  @IsOptional()
  @IsBoolean()
  cash_on_delivery?: boolean;

  @IsOptional()
  @IsNumber()
  cash_amount?: number;

  @IsOptional()
  @IsBoolean()
  settled_to_sender?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments: PaymentDto[];

  @IsOptional()
  @IsString()
  parent_id?: string;

  @IsOptional()
  @IsNumber()
  order_price?: number;

  @IsOptional()
  @IsNumber()
  reference?: string;

  @IsString()
  city?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CourierDto)
  zone?: ZoneDto;
}

export class ZoneDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  price: string;

  @IsString()
  @IsNotEmpty()
  cod_zone: string;
}

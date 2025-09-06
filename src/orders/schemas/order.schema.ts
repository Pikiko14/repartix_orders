import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrderDocument = Order & Document;

@Schema({ _id: false })
class Coords {
  @Prop() lat: number;
  @Prop() lng: number;
}

@Schema({ _id: false })
class Client {
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) last_name: string;
  @Prop({ required: true }) address: string;
  @Prop() phone?: string;
  @Prop() email?: string;
  @Prop() coords?: Coords;
  @Prop({ index: true }) dni?: string;
}

@Schema({ _id: false })
class SenderAddress {
  @Prop({ required: true }) address: string;
  @Prop({ required: true }) complement: string;
  @Prop({ required: true }) coords: Coords;
}

@Schema({ _id: false })
class Sender {
  @Prop({ required: true, index: true }) brand_name: string;
  @Prop({ index: true }) brand_phone?: string;
  @Prop({ required: true }) address: SenderAddress;
  @Prop({ required: true }) sender_id: string;
}

@Schema({ _id: false })
class Product {
  @Prop() sku?: string;
  @Prop({ required: true }) name: string;
  @Prop() description?: string;
  @Prop({ required: true }) quantity: string;
  @Prop({ required: true }) unit_price: string;
  @Prop() total_price?: number;
  @Prop() weight?: number;
}

@Schema({ _id: false })
class Courier {
  @Prop({ required: true, index: true }) full_name: string;
  @Prop() vehicle_type?: string;
  @Prop() license_plate?: string;
  @Prop() phone?: string;
}

@Schema({ _id: false })
class Payment {
  @Prop({ required: true, index: true }) methods: string;
  @Prop({ required: true }) amount: string;
  @Prop({ required: false }) date: Date;
  @Prop({ required: false }) file?: string;
}

@Schema({ _id: false })
class Zone {
  @Prop({ required: false, index: true }) name: string;
  @Prop({ required: false }) price: string;
  @Prop({ required: false }) cod_zone: string;
}

// schema statuses
@Schema({ _id: false })
class Statuses {
  @Prop({ required: true, default: 'pending' }) status?: string;
  @Prop({ default: Date.now() }) date: Date;
  @Prop() description?: string;
}

// schema news
@Schema({ _id: false })
class News {
  @Prop({ required: true }) type_news: string;
  @Prop({ required: true }) description: string;
  @Prop({ required: false }) file: string;
  @Prop({ required: false }) resolve_answer: string;
  @Prop({ required: false, default: Date.now() }) date: Date;
}

// schema de order
@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true }) date: Date;
  @Prop() scheduled_date?: Date;

  @Prop({
    required: true,
    default: 'pending',
  })
  status: string;

  @Prop({ required: true, type: Client }) client: Client;
  @Prop({ required: true, type: Sender }) sender: Sender;
  @Prop({ type: [Product], default: [] }) products: Product[];
  @Prop({ type: Courier }) courier?: Courier;

  @Prop({ default: false, index: true }) cash_on_delivery?: boolean;
  @Prop({ default: 0 }) cash_amount?: string;
  @Prop({ default: false, index: true }) settled_to_sender?: boolean;
  @Prop() settled_date?: Date;

  @Prop() notes?: string;
  @Prop({ type: [Payment], default: [] }) payments: Payment[];

  @Prop({ index: true }) parent_id?: string;

  @Prop({ required: true }) order_price: number;

  @Prop({ index: true }) reference?: string;

  @Prop({ index: true }) city?: string;
  @Prop({ type: Zone }) zone?: Zone;
  @Prop({ default: false }) print_guide?: boolean;
  @Prop({ type: [Statuses], default: [{ status: 'pending', date: Date.now() }] }) statuses: Statuses[];
  @Prop({ type: [News], default: [] }) news: News[];
  @Prop({ default: 0, required: false }) discount?: number;
}

const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ 'client.name': 1, 'client.last_name': 1 });

export { OrderSchema };

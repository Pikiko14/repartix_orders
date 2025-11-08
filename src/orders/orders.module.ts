import { Module } from '@nestjs/common';
import { Utils } from 'src/commons/utils/utils';
import { OrdersService } from './orders.service';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { NatsModule } from 'src/transports/nats.module';
import { OrderSchema, Order } from './schemas/order.schema';
import { OrdersRepository } from './repository/orders.repository';
import { CacheServiceModule } from 'src/commons/cache/cache.module';
import { CloudinaryModule } from 'src/commons/cloudinary/cloudinary.module';
import { BullModule } from '@nestjs/bull';
import { ReportPdfProcessor } from './processors/report-pdf.processor';
import { ReportPdfService } from './services/report-pdf.service';
import { InvoicePdfProcessor } from './processors/invoice-pdf.processor';
import { InvoicePdfService } from './services/invoice-pdf.service';

@Module({
  imports: [
    NatsModule,
    MongooseModule.forFeature([
      {
        name: Order.name,
        schema: OrderSchema,
      }
    ]),
    CloudinaryModule,
    CacheServiceModule,
    BullModule.registerQueue({
      name: 'reports',
    }),
    BullModule.registerQueue({
      name: 'invoices',
    }),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    Utils,
    ReportPdfProcessor,
    ReportPdfService,
    InvoicePdfProcessor,
    InvoicePdfService,
  ],
})
export class OrdersModule {}

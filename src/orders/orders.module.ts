import { Module } from '@nestjs/common';
import { Utils } from 'src/commons/utils/utils';
import { OrdersService } from './orders.service';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { NatsModule } from 'src/transports/nats.module';
import { OrderSchema, Order } from './schemas/order.schema';
import { OrdersRepository } from './repository/orders.repository';
import { CacheServiceModule } from 'src/commons/cache/cache.module';

@Module({
  imports: [
    NatsModule,
    MongooseModule.forFeature([
      {
        name: Order.name,
        schema: OrderSchema,
      }
    ]),
    CacheServiceModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, Utils],
})
export class OrdersModule {}

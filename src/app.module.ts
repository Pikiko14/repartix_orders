import { envs } from './configuration';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheServiceModule } from './commons/cache/cache.module';
import { OrdersModule } from './orders/orders.module';
import { QueuesModule } from './commons/queues/queues.module';

@Module({
  imports: [
    QueuesModule,
    CacheServiceModule,
    MongooseModule.forRoot(envs.app_env === 'production' ?  envs.atlas_url : envs.db_url,),
    OrdersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

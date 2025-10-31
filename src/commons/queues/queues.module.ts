import { BullModule } from '@nestjs/bull';
import { envs } from '../../configuration';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: envs.redis_host,
          port: envs.redis_port,
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}



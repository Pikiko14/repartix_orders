import { Module } from '@nestjs/common';
import { envs } from 'src/configuration';
import { CacheService } from './cache.service';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-ioredis';

@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      host: envs.redis_host,
      port: envs.port,
      ttl: 600, // segundos
    })
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheServiceModule {}

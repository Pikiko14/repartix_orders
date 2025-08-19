import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class CacheService {
  logger = new Logger(CacheService.name);
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  /**
   * Set item in cache
   * @param key
   * @param payload
   */
  async setItem(key: string, payload: any, ttl = 600000): Promise<void | boolean> {
    this.logger.log(`Se ha guardado el item: ${key} en cache por 10min`);
    await this.cache.set(key, JSON.stringify(payload), ttl);
  }

  /**
   * Get item from cache
   * @param key
   * @returns
   */
  async getItem(key): Promise<void | any> {
    const data = await this.cache.get(key);
    if (data) {
      this.logger.log(`Se ha obtenido el item: ${key} de la cache`);
      return JSON.parse(data as string);
    }
  }

  /**
   * Remoive iten in cache
   * @param key
   */
  async removeItem(key): Promise<void | boolean> {
    this.logger.log(`Se ha eliminado el item: ${key} de la cache`);
    return await this.cache.del(key);
  }

  /**
   * removeByPrefix
   * @param prefix
   * @returns
   */
  async removeByPrefix(prefix: string): Promise<void> {
    const store: any = this.cache.stores.forEach((stores) => {
      const { store } = stores.opts as any;
      for (const [key] of store.entries()) {
        if (key.startsWith(prefix)) {
          this.removeItem(key.substring(5));
        }
      }
    });
  }
}

import { envs } from 'src/configuration';
import { Utils } from 'src/commons/utils/utils';
import { OrderEntity } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CacheService } from 'src/commons/cache/cache.service';
import { QueryParamDto } from 'src/commons/dto/query-param.dto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrdersRepository } from './repository/orders.repository';
import { FindAndDeleteOrderDto } from './dto/find-and-delete-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly utils: Utils,
    private readonly cacheService: CacheService,
    private readonly repository: OrdersRepository,
    @Inject(envs.nats_service_name) private readonly client: ClientProxy,
  ) {}

  async create(createOrderDto: CreateOrderDto) {
    try {
      await this.cacheService.removeByPrefix(
        `keyv:${createOrderDto.parent_id}:orders:list`,
      );

      // creo la orden
      const totalUserOder = await this.repository.countByParentId(
        createOrderDto.parent_id,
      );
      const reference = `${(totalUserOder || 0) + 1}`.padStart(8, '0');
      createOrderDto.reference = reference;

      const order = await this.repository.create(createOrderDto);

      // validate and print order
      if (createOrderDto?.print_guide) {
        this.client.emit('create-guide', createOrderDto);
      }

      // return response
      return {
        success: true,
        data: order,
        message: 'Order created successfully',
      };
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }

  async findAll(queryParams: QueryParamDto) {
    const cacheKey = `${queryParams.parent_id}:orders:list:${JSON.stringify(queryParams)}`;
    let orders = await this.cacheService.getItem(cacheKey);
    if (orders) {
      return {
        success: true,
        orders,
        message: 'Orders list (from cache)',
      };
    }

    try {
      // construimos un $and global
      const andConditions: any[] = [{ parent_id: queryParams.parent_id }];

      // validamos la búsqueda
      if (queryParams.search) {
        const searchRegex = new RegExp(queryParams.search as string, 'i');
        andConditions.push({
          $or: [
            { 'client.name': searchRegex },
            { 'client.last_name': searchRegex },
            { 'client.address': searchRegex },
            { 'client.phone': searchRegex },
            { 'client.email': searchRegex },
            { 'client.dni': searchRegex },
            { 'sender.brand_name': searchRegex },
            { 'sender.brand_phone': searchRegex },
            { reference: searchRegex },
          ],
        });
      }

      // rango de fechas
      const { startOfMonth, endOfMonth } = this.utils.getMonthRange(new Date());
      let startOfDay = new Date(startOfMonth.setHours(0, 0, 0, 0));
      let endOfDay = new Date(endOfMonth.setHours(23, 59, 59, 999));

      if (queryParams.from && queryParams.to) {
        const from = new Date(queryParams.from);
        const to = new Date(queryParams.to);
        startOfDay = new Date(from.setHours(0, 0, 0, 0));
        endOfDay = new Date(to.setHours(23, 59, 59, 999));
      }

      andConditions.push({ date: { $gte: startOfDay, $lte: endOfDay } });

      // filtros adicionales
      if (queryParams.filters) {
        const filterObj = JSON.parse(queryParams.filters);
        for (const key of Object.keys(filterObj)) {
          andConditions.push({ [key]: filterObj[key] });
        }
      }

      // query final
      const query: Record<string, any> = { $and: andConditions };

      // paginación
      const page = Number(queryParams.page) || 1;
      const perPage = Number(queryParams.perPage) || 7;
      const skip = (page - 1) * perPage;

      orders = await this.repository.paginate(query, skip, perPage);

      // cache por 10 min
      await this.cacheService.setItem(cacheKey, orders);

      return {
        success: true,
        orders,
        message: 'Orders list',
      };
    } catch (error) {
      throw new RpcException(error.message);
    }
  }

  async findOne(findDto: FindAndDeleteOrderDto) {
    try {
      const cacheKey = `${findDto.parent_id}:orders:list:${JSON.stringify(findDto)}`;
      let order = await this.cacheService.getItem(cacheKey);
      if (order) {
        return {
          success: true,
          order,
          message: 'Orders data (from cache)',
        };
      }

      // creo el cliente
      order = await this.repository.find({
        key: '_id',
        value: findDto.id,
      });

      if (!order)
        throw new RpcException({
          message: `Order with this id: ${findDto.id} not found`,
          status: HttpStatus.NOT_FOUND,
          error: true,
        });

      await this.cacheService.setItem(cacheKey, order, 300000);

      // return response
      return {
        success: true,
        order,
        message: 'Order data',
      };
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    let order = await this.repository.find({
      key: '_id',
      value: id,
    });

    if (!order)
      throw new RpcException({
        message: `Order with this id: ${id} not found`,
        status: HttpStatus.NOT_FOUND,
        error: true,
      });

    await this.cacheService.removeByPrefix(
      `keyv:${updateOrderDto.parent_id}:orders:list`,
    );

    try {
      order = await this.repository.update(id, updateOrderDto);

      // validate and print order
      if (updateOrderDto?.print_guide) {
        this.client.emit('create-guide', updateOrderDto);
      }

      // return data
      return {
        success: true,
        data: order,
        message: 'Order update success',
      };
    } catch (error) {
      throw new RpcException(error.message);
    }
  }

  async remove(deleteDto: FindAndDeleteOrderDto) {
    await this.cacheService.removeByPrefix(
      `keyv:${deleteDto.parent_id}:orders:list`,
    );

    let order: OrderEntity | void = await this.repository.find({
      key: '_id',
      value: deleteDto.id,
    });

    if (!order) {
      throw new RpcException({
        message: `Order with this id: ${deleteDto.id} not found`,
        status: HttpStatus.NOT_FOUND,
        error: true,
      });
    }

    try {
      order = await this.repository.delete(deleteDto.id, deleteDto.parent_id);

      // return data
      return {
        success: true,
        data: order,
        message: 'Order delete success',
      };
    } catch (error) {
      throw new RpcException(error.message);
    }
  }
}

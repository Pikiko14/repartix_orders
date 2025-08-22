import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { RpcException } from '@nestjs/microservices';
import { OrderEntity } from '../entities/order.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { Order, OrderDocument } from '../schemas/order.schema';
import { IOrdersRepository } from 'src/commons/interfaces/respository.interface';
import { PaginationResponseInterface } from 'src/commons/interfaces/response.interface';

@Injectable()
export class OrdersRepository implements IOrdersRepository {
  constructor(@InjectModel(Order.name) private readonly model: Model<Order>) {}

  async create(createOrderDto: CreateOrderDto): Promise<OrderEntity | unknown> {
    try {
      return (await this.model.create(createOrderDto)) as any;
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }

  async find(params: {
    key: keyof OrderEntity | any;
    value: any;
  }): Promise<OrderEntity | null> {
    try {
      return await this.model.findOne({ [params.key]: params.value });
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }

  async update(
    id: string | number,
    user: OrderEntity | UpdateOrderDto,
  ): Promise<OrderEntity | null> {
    try {
      return await this.model.findByIdAndUpdate(id, user, { new: true });
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }

  async delete(id: string, parent: string): Promise<void> {
    try {
      return await this.model.findOneAndDelete({ _id: id, parent_id: parent });
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }

  /**
   * Paginate orders
   * @param query - Query object for filtering results
   * @param skip - Number of documents to skip
   * @param perPage - Number of documents per page
   * @param sortBy - Field to sort by (default: "name")
   * @param order - Sort order (1 for ascending, -1 for descending, default: "1")
   */
  public async paginate(
    query: Record<string, any>,
    skip: number,
    perPage: number,
    fields: string[] = [
      '_id',
      'status',
      'date',
      'client.name',
      'client.last_name',
      'client.address',
      'sender.brand_name',
      'cash_on_delivery',
      'cash_amount',
      'settled_to_sender',
      'order_price',
      'reference',
      'city',
      'zone'
    ],
  ): Promise<PaginationResponseInterface> {
    try {
      // Fetch paginated data
      const users = await this.model
        .find(query)
        .select(fields.length > 0 ? fields.join(' ') : '')
        .skip(skip)
        .limit(perPage);

      // Get total count of matching documents
      const totalUsers = await this.model.countDocuments(query);

      // Calculate total pages
      const totalPages = Math.ceil(totalUsers / perPage);

      return {
        data: users,
        totalPages,
        totalItems: totalUsers,
      };
    } catch (error: any) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }

  /**
   * count order by user
   * @param { string } parentId
   */
  public async countByParentId(parentId: string): Promise<number> {
    try {
      return await this.model.countDocuments({ parent_id: parentId });
    } catch (error: any) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }
}

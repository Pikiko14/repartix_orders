import { OrderEntity } from "src/orders/entities/order.entity";
import { CreateOrderDto } from "src/orders/dto/create-order.dto";
import { UpdateOrderDto } from "src/orders/dto/update-order.dto";
import { UpdateStatusDto } from "src/orders/dto/update-status.dto";

export interface IOrdersRepository {
  create(createOrderDto: CreateOrderDto): Promise<any | unknown>;
  
  find(params: { key: keyof OrderEntity; value: any }): Promise<OrderEntity | null>;
  
  update(id: string, order: any): Promise<OrderEntity | UpdateOrderDto | null>;
  
  delete(id: string, parent_id: string): Promise<void | OrderEntity>;

  updateStatus(updateStatusDto: UpdateStatusDto): Promise<void>;
}

import { Controller } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { QueryParamDto } from 'src/commons/dto/query-param.dto';
import { FindAndDeleteOrderDto } from './dto/find-and-delete-order.dto';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @MessagePattern('create-order')
  create(@Payload() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @MessagePattern('list-order')
  findAll(queryParams: QueryParamDto) {
    return this.ordersService.findAll(queryParams);
  }

  @MessagePattern('find-order')
  findOne(@Payload() findDto: FindAndDeleteOrderDto) {
    return this.ordersService.findOne(findDto);
  }

  @MessagePattern('update-order')
  update(@Payload() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(updateOrderDto.id, updateOrderDto);
  }

  @MessagePattern('remove-order')
  remove(@Payload() deleteDto: FindAndDeleteOrderDto) {
    return this.ordersService.remove(deleteDto);
  }

  @MessagePattern('update-status-order')
  updateStatusOrder(@Payload() updateStatusDto: UpdateStatusDto) {
    return this.ordersService.updateStatusOrder(updateStatusDto);
  }

  @MessagePattern('create-order-news')
  createNews(@Payload() updateStatusDto: CreateNewsDto) {
    return this.ordersService.createNews(updateStatusDto);
  }
}

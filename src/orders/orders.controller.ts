import { Controller } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { LiquidateOrderDto } from './dto/liquidate-orders.dto';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { QueryParamDto } from 'src/commons/dto/query-param.dto';
import { QueryReportDto } from 'src/commons/dto/query-report.dto';
import { LoadDashboardDataDto } from './dto/load-dashboard-data.dto';
import { FindAndDeleteOrderDto } from './dto/find-and-delete-order.dto';
import { GenerateReportPdfDto } from './dto/generate-report-pdf.dto';

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

  @MessagePattern('create-order-payment')
  createPayment(@Payload() createPaymentDto: CreatePaymentDto) {
    return this.ordersService.createPayment(createPaymentDto);
  }

  @MessagePattern('load-dashboard-data')
  loadDashboardData(@Payload() dashboardDataDto: LoadDashboardDataDto) {
    return this.ordersService.loadDashboardData(dashboardDataDto);
  }

  @MessagePattern('get-orders-by-id-array')
  getOrderByIdArray(@Payload() ids: string[]) {
    return this.ordersService.getOrderByIdArray(ids);
  }

  @MessagePattern('liquidate-order')
  liquidateOrders(@Payload()  liquidateOrderDto: LiquidateOrderDto) {
    return this.ordersService.liquidateOrders(liquidateOrderDto);
  }

  @MessagePattern('order-diary-report')
  diaryReport(@Payload() queryReportDto: QueryReportDto) {
    return this.ordersService.diaryReport(queryReportDto);
  }

  @MessagePattern('set-courier-in-orders')
  setCourierInOrder(@Payload() updateCourierDto: any) {
    return this.ordersService.setCourierInOrder(updateCourierDto);
  }

  @MessagePattern('order-liquidation-report')
  reportLiquidation(@Payload() queryReportDto: QueryReportDto) {
    return this.ordersService.reportLiquidation(queryReportDto);
  }

  @MessagePattern('generate-report-pdf')
  generateReportPdf(@Payload() generateReportPdfDto: GenerateReportPdfDto) {
    return this.ordersService.generateReportPdf(generateReportPdfDto);
  }
}

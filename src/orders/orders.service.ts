import { firstValueFrom } from 'rxjs';
import { envs } from 'src/configuration';
import { Utils } from 'src/commons/utils/utils';
import { CreateNewsDto } from './dto/create-news.dto';
import { OrderDocument } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { LiquidateOrderDto } from './dto/liquidate-orders.dto';
import { CacheService } from 'src/commons/cache/cache.service';
import { QueryParamDto } from 'src/commons/dto/query-param.dto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderEntity, StatusEnum } from './entities/order.entity';
import { OrdersRepository } from './repository/orders.repository';
import { QueryReportDto } from 'src/commons/dto/query-report.dto';
import { LoadDashboardDataDto } from './dto/load-dashboard-data.dto';
import { FindAndDeleteOrderDto } from './dto/find-and-delete-order.dto';
import { GenerateReportPdfDto } from './dto/generate-report-pdf.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class OrdersService {
  constructor(
    private readonly utils: Utils,
    private readonly cacheService: CacheService,
    private readonly repository: OrdersRepository,
    @Inject(envs.nats_service_name) private readonly client: ClientProxy,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
    @InjectQueue('invoices') private readonly invoicesQueue: Queue,
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
        andConditions.push({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
      }

      // filtros adicionales
      if (queryParams.filters) {
        const filterObj = JSON.parse(queryParams.filters);
        for (const key of Object.keys(filterObj)) {
          andConditions.push({ [key]: filterObj[key] });
        }
      }

      // validamos si el usuario que solicita es remitente
      if (queryParams.type_user === 'sender') {
        andConditions.push({
          'sender.sender_id': queryParams.main_user_id,
        });
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

    //if (order.status !== 'pending')
    //  throw new RpcException({
    //    message: `The order with ID ${id} must be in pending status to be updated.`,
    //    status: HttpStatus.BAD_REQUEST,
    //    error: true,
    //  });

    await this.cacheService.removeByPrefix(
      `keyv:${updateOrderDto.parent_id}:orders:list`,
    );

    try {
      if (!updateOrderDto.print_guide)
        updateOrderDto.status = StatusEnum.pending;

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

    if (!order)
      throw new RpcException({
        message: `Order with this id: ${deleteDto.id} not found`,
        status: HttpStatus.NOT_FOUND,
        error: true,
      });

    if (order.status !== 'pending')
      throw new RpcException({
        message: `The order with ID ${deleteDto.id} must be in pending status to be deleted.`,
        status: HttpStatus.BAD_REQUEST,
        error: true,
      });

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

  async updateStatusOrder(updateStatusDto: UpdateStatusDto) {
    try {
      let order = await this.repository.findOrderByReferenceAndUser(
        updateStatusDto.order_reference,
        updateStatusDto.parent_id,
      );

      if (!order)
        throw new RpcException({
          message: `Order with this reference: ${updateStatusDto.order_reference} not found`,
          status: HttpStatus.NOT_FOUND,
          error: true,
        });

      await this.cacheService.removeByPrefix(
        `keyv:${updateStatusDto.parent_id}:orders:list`,
      );

      const status = {
        status: updateStatusDto.status,
        date: new Date(),
      };

      order.statuses.push(status);
      order.status = updateStatusDto.status;
      order.print_guide = updateStatusDto.status === 'pending' ? false : true;

      if (updateStatusDto.status === 'delivered') {
        this.client.emit('update-shipping-list-order', {
          status: updateStatusDto.status,
          reference: updateStatusDto.order_reference,
          parent_id: updateStatusDto?.parent_id,
          order_id: order.id,
        });
      }

      order = await this.repository.updateStatus(order.id, order) as OrderDocument;

      // Emitir notificación interna
      this.client.emit('create-internal-notification', {
        parent_id: updateStatusDto.parent_id,
        room: `admin-${updateStatusDto.parent_id}`,
        type: 'order_status_updated',
        title: 'Estado de Orden Actualizado',
        message: `La orden ${updateStatusDto.order_reference} cambió a estado: ${updateStatusDto.status}`,
        metadata: {
          order_id: order.id,
          order_reference: updateStatusDto.order_reference,
          old_status: order.status,
          new_status: updateStatusDto.status,
          user_request_id: updateStatusDto.user_request_id, // Mantener info del usuario que hizo la acción
        },
        priority: updateStatusDto.status === 'delivered' ? 'high' : 'medium',
      });

      return {
        success: true,
        data: order,
        message: 'Order status update success',
      };
    } catch (error) {
      throw new RpcException(error.message);
    }
  }

  async createNews(createNewsDto: CreateNewsDto) {
    try {
      const { file } = createNewsDto;
      delete createNewsDto.file;

      let order = await this.repository.find({
        key: '_id',
        value: createNewsDto.order_id,
      });

      if (!order)
        throw new RpcException({
          message: `Order with this id: ${createNewsDto.order_id} not found`,
          status: HttpStatus.NOT_FOUND,
          error: true,
        });

      const news = {
        type_news: createNewsDto.type_news,
        description: createNewsDto.description,
      };

      if (file) {
        const path = await this.utils.processFile(file);
        news['file'] = path;
      }

      order.news.push(news);

      order = await this.repository.update(order.id, order);

      await this.cacheService.removeByPrefix(
        `keyv:${createNewsDto.parent_id}:orders:list`,
      );

      // Emitir notificación interna
      this.client.emit('create-internal-notification', {
        parent_id: createNewsDto.parent_id,
        room: `admin-${createNewsDto.parent_id}`,
        type: 'order_news_created',
        title: 'Nueva Novedad en Orden',
        message: `Se registró una novedad en la orden ${order.reference}: ${createNewsDto.type_news}`,
        metadata: {
          order_id: order.id,
          order_reference: order.reference,
          news_type: createNewsDto.type_news,
          news_description: createNewsDto.description,
          user_request_id: createNewsDto.user_request_id, // Mantener info del usuario que hizo la acción
        },
        priority: 'high',
      });

      return {
        success: true,
        order,
        message: 'News created successfully',
      };
    } catch (error) {
      throw new RpcException(error.message);
    }
  }

  async createPayment(createPaymentDto: CreatePaymentDto) {
    try {
      const { file } = createPaymentDto;
      const orderId = createPaymentDto.order_id;
      const parentId = createPaymentDto.parent_id;
      delete createPaymentDto.file;

      let order = await this.repository.find({
        key: '_id',
        value: orderId,
      });

      delete createPaymentDto.order_id;

      if (!order)
        throw new RpcException({
          message: `Order with this id: ${orderId} not found`,
          status: HttpStatus.NOT_FOUND,
          error: true,
        });

      const payment = {
        methods: createPaymentDto.methods,
        amount: createPaymentDto.amount,
        date: new Date(),
      };

      if (file) {
        const path = await this.utils.processFile(file);
        payment['file'] = path || '';
      }

      order.payments.push(payment);

      order = await this.repository.update(order.id, order);

      await this.cacheService.removeByPrefix(
        `keyv:${parentId}:orders:list`,
      );

      // Emitir notificación interna
      this.client.emit('create-internal-notification', {
        parent_id: parentId,
        room: `admin-${createPaymentDto.parent_id}`,
        type: 'order_payment_created',
        title: 'Pago Registrado',
        message: `Se registró un pago de ${createPaymentDto.amount} en la orden ${order.reference}`,
        metadata: {
          order_id: order.id,
          order_reference: order.reference,
          payment_method: createPaymentDto.methods,
          payment_amount: createPaymentDto.amount,
          user_request_id: createPaymentDto.user_request_id, // Mantener info del usuario que hizo la acción
        },
        priority: 'medium',
      });

      return {
        success: true,
        order,
        message: 'Payment created successfully',
      };
    } catch (error) {
      throw new RpcException(error.message);
    }
  }

  async loadDashboardData(dashboardDataDto: LoadDashboardDataDto) {
    try {
      const cacheKey = `${dashboardDataDto.parent_id}:orders:list:dashboard:${JSON.stringify(dashboardDataDto)}`;

      let data = await this.cacheService.getItem(cacheKey);
      if (data) {
        return {
          success: true,
          data,
          message: 'Dashboard data (from cache)',
        };
      }

      // base de condiciones
      const baseConditions: any[] = [{ parent_id: dashboardDataDto.parent_id }];

      // fechas
      const { startOfMonth, endOfMonth } = this.utils.getMonthRange(new Date());
      let startOfDay = new Date(startOfMonth.setHours(0, 0, 0, 0));
      let endOfDay = new Date(endOfMonth.setHours(23, 59, 59, 999));

      if (dashboardDataDto.from && dashboardDataDto.to) {
        const from = new Date(dashboardDataDto.from);
        const to = new Date(dashboardDataDto.to);
        startOfDay = new Date(from.setHours(0, 0, 0, 0));
        endOfDay = new Date(to.setHours(23, 59, 59, 999));
      }

      baseConditions.push({ createdAt: { $gte: startOfDay, $lte: endOfDay } });

      if (dashboardDataDto.type_user === 'sender') {
        baseConditions.push({
          'sender.sender_id': dashboardDataDto.main_user_id,
        });
      }

      // ---- QUERY 0: clients orders ----
      const clientsOrdersQuery = { $and: [...baseConditions] };
      const orders =
        await this.repository.findOrdersClients(clientsOrdersQuery);

      // ---- QUERY 1: total orders ----
      const totalOrdersQuery = { $and: [...baseConditions] };
      const totalOrders =
        await this.repository.countModelByQuery(totalOrdersQuery);

      // ---- QUERY 2: delivered ----
      const deliveredQuery = {
        $and: [...baseConditions, { status: StatusEnum.delivered }],
      };
      const delivered = await this.repository.countModelByQuery(deliveredQuery);

      // ---- QUERY 3: pending ----
      const pendingQuery = {
        $and: [...baseConditions, { status: StatusEnum.pending }],
      };
      const pending = await this.repository.countModelByQuery(pendingQuery);

      // ---- QUERY 4: cancelled ----
      const cancelledQuery = {
        $and: [...baseConditions, { status: StatusEnum.cancelled }],
      };
      const cancelled = await this.repository.countModelByQuery(cancelledQuery);

      // ---- QUERY 4: cancelled ----
      const newsQuery = {
        $and: [...baseConditions, { status: StatusEnum.guide_news }],
      };
      const news = await this.repository.countModelByQuery(newsQuery);

      data = {
        totalOrders,
        delivered,
        pending,
        cancelled,
        news,
        orders,
      };

      await this.cacheService.setItem(cacheKey, data);

      return {
        success: true,
        data,
        message: 'Dashboard data',
      };
    } catch (error) {
      throw new RpcException(error.message);
    }
  }

  async getOrderByIdArray(ids: string[]) {
    try {
      return await this.repository.findOrdersByArrayIds(ids);
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
        error: true,
      });
    }
  }

  async liquidateOrders(liquidateOrderDto: LiquidateOrderDto) {
    try {
      // validate order is liquidate
      const order = await this.repository.validateIfOneOrderIsLiquidated(
        liquidateOrderDto.ordersIds,
      );
      if (order)
        throw new RpcException({
          error: true,
          status: HttpStatus.NOT_FOUND,
          message: `This order ${order.reference} is already liquidated`,
        });

      // handler liquidate
      const orders = await this.repository.liquidateOrders(liquidateOrderDto);

      await this.cacheService.removeByPrefix(
        `keyv:${liquidateOrderDto.parent_id}:orders:list`,
      );

      return {
        success: true,
        orders,
        message: 'Orders liquidated successfully',
      };
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
        error: true,
      });
    }
  }

  async diaryReport(queryReportDto: QueryReportDto) {
    try {
      const cacheKey = `${queryReportDto.parent_id}:orders:list:report-diary:${JSON.stringify(queryReportDto)}`;
      let dataReport = await this.cacheService.getItem(cacheKey);
      if (dataReport) {
        return {
          success: true,
          data: dataReport,
          message: 'Diary report (from cache)',
        };
      }

      // construimos un $and global
      const andConditions: any[] = [{ parent_id: queryReportDto.parent_id }];

      // validamos la fecha
      if (queryReportDto.date) {
        const date = new Date(queryReportDto.date);
        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));
        andConditions.push({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
      }

      // validamos courier
      if (queryReportDto.courier) {
        const searchRegex = new RegExp(queryReportDto.courier as string, 'i');
        andConditions.push({
          $or: [
            { 'courier.full_name': searchRegex },
            { 'courier.vehicle_type': searchRegex },
            { 'courier.license_plate': searchRegex },
          ],
        });
      }

      // query final
      const query: Record<string, any> = { $and: andConditions };

      const orders = await this.repository.diaryReport(query) as any;

      // filter statuses
      const delivared = orders.filter(
        (el) => el.status === StatusEnum.delivered,
      ).length;
      const printed = orders.filter(
        (el) => el.status === StatusEnum.guide_printed,
      ).length;
      const pending = orders.filter(
        (el) => el.status === StatusEnum.pending,
      ).length;
      const cancelled = orders.filter(
        (el) => el.status === StatusEnum.cancelled,
      ).length;
      const news = orders.filter(
        (el) => el.status === StatusEnum.guide_news,
      ).length;
      const inProgress = orders.filter(
        (el) => el.status === StatusEnum.in_progress,
      ).length;
      const totalCashAmount = orders.reduce(
        (acc, order) => acc + parseFloat(order.cash_amount.replace('.', '')),
        0,
      );
      const totalCollected = orders.reduce(
        (acc, order) => acc + parseFloat(order.collected),
        0,
      );

      // set in cache
      dataReport = {
        orders,
        totalOrders: orders.length,
        delivared,
        printed,
        pending,
        cancelled,
        news,
        in_progress: inProgress,
        totalCashAmount,
        totalCollected,
      };
      await this.cacheService.setItem(cacheKey, dataReport);

      return {
        success: true,
        data: dataReport,
        message: 'Diary report',
      };
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
        error: true,
      });
    }
  }

  async setCourierInOrder(updateCourierDto: any) {
    try {
      const order = await this.repository.findOrdersByArrayIds(updateCourierDto.ordersIds);
      if (!order)
        throw new RpcException({
          message: `Order with this id: ${updateCourierDto.order_id} not found`,
          status: HttpStatus.NOT_FOUND,
          error: true,
        });

      // set courier
      await this.repository.setCourierInOrders(updateCourierDto);

      await this.cacheService.removeByPrefix(
        `keyv:${updateCourierDto.parent_id}:orders:list`,
      );
      return true;
    } catch (error) {
      throw new RpcException({
        error: true,
        status: HttpStatus.BAD_REQUEST,
        message: error.message,
      });
    }
  }

  async reportLiquidation(queryReportDto: QueryReportDto) {
    try{
      const cacheKey = `${queryReportDto.parent_id}:orders:list:report-liquidation:${JSON.stringify(queryReportDto)}`;
      let dataReport = await this.cacheService.getItem(cacheKey);
      if (dataReport) {
        return {
          success: true,
          data: dataReport,
          message: 'Liquidation report (from cache)',
        };
      }

      // get sender data
      const { data } = await firstValueFrom(
        this.client.send('get-sender-by-name', {
          name: queryReportDto.sender,
          parent_id: queryReportDto.parent_id,
        })
      );
      let porcentageComission = 0;

      if (data) {
        const { sender_info } = data;
        porcentageComission = sender_info.comission_porcent;
      }

      // construimos un $and global
      const searchRegex = new RegExp(queryReportDto.sender as string, 'i');
      const andConditions: any[] = [{
        settled_to_sender: true,
        'sender.brand_name': searchRegex,
        parent_id: queryReportDto.parent_id,
        cash_on_delivery: true,
      }];

      let startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
      let endOfDay = new Date(new Date().setHours(23, 59, 59, 999));

      if (queryReportDto.from && queryReportDto.to) {
        const from = new Date(queryReportDto.from);
        const to = new Date(queryReportDto.to);
        startOfDay = new Date(from.setHours(0, 0, 0, 0));
        endOfDay = new Date(to.setHours(23, 59, 59, 999));
        andConditions.push({ settled_date: { $gte: startOfDay, $lte: endOfDay } });
      }

      const query: Record<string, any> = { $and: andConditions };

      const orders = await this.repository.liquidationReport(query, porcentageComission) as any;

      const ordersNoSettled = await this.repository.countOrdersByQuery({
        settled_to_sender: false,
        'sender.brand_name': searchRegex,
        parent_id: queryReportDto.parent_id,
        settled_date: { $gte: startOfDay, $lte: endOfDay },
        //cash_on_delivery: true,
      });

      const totalComission = orders.reduce(
        (acc, order) => acc + parseFloat(order.comission),
        0,
      );

      const totalLiquidate = orders.reduce(
        (acc, order) => acc + parseFloat(order.total_to_liquidate),
        0,
      );

      const totalCollection = orders.reduce(
        (acc, order) => acc + parseFloat(order.cash_amount.replace('.', '')),
        0,
      );

      dataReport = {
        orders,
        totalOrdersLiquidated: orders.length,
        ordersNoSettled,
        totalComission,
        totalLiquidate,
        totalCollection,
      };

      // set en cache
      await this.cacheService.setItem(cacheKey, dataReport);

      return {
        success: true,
        data: dataReport,
        message: 'Liquidation report',
      };
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
        error: true,
      });
    }
  }

  async generateReportPdf(generateReportPdfDto: GenerateReportPdfDto) {
    try {
      // Agregar trabajo a la cola para procesamiento en background
      const job = await this.reportsQueue.add('generate', generateReportPdfDto, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      return {
        success: true,
        message: 'Report PDF generation started',
        data: {
          job_id: job.id,
          report_type: generateReportPdfDto.report_type,
          status: 'processing',
        },
      };
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
        error: true,
      });
    }
  }

  async performanceReport(performanceReportDto: any) {
    try {
      const andConditions: any[] = [{ parent_id: performanceReportDto.parent_id }];

      if (performanceReportDto.from && performanceReportDto.to) {
        const from = new Date(performanceReportDto.from);
        const to = new Date(performanceReportDto.to);
        const startOfDay = new Date(from.setHours(0, 0, 0, 0));
        const endOfDay = new Date(to.setHours(23, 59, 59, 999));
        andConditions.push({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
      }

      if (performanceReportDto.courier) {
        const searchRegex = new RegExp(performanceReportDto.courier as string, 'i');
        andConditions.push({
          $or: [
            { 'courier.full_name': searchRegex },
            { 'courier.vehicle_type': searchRegex },
            { 'courier.license_plate': searchRegex },
          ],
        });
      }

      const query: Record<string, any> = { $and: andConditions };
      const orders = await this.repository.performanceReport(query) as any;

      // Calcular métricas
      const totalOrders = orders.length;
      const deliveredOrders = orders.filter((el: any) => el.status === StatusEnum.delivered);

      // Tiempos promedio de entrega (desde creación hasta entrega)
      const deliveryTimes: number[] = [];
      deliveredOrders.forEach((order: any) => {
        const createdAt = new Date(order.createdAt || order.date);
        const deliveredStatus = order.statuses?.find((s: any) => s.status === 'delivered');
        if (deliveredStatus) {
          const deliveredDate = new Date(deliveredStatus.date);
          const timeDiff = deliveredDate.getTime() - createdAt.getTime();
          const hoursDiff = timeDiff / (1000 * 60 * 60); // horas
          if (hoursDiff >= 0) {
            deliveryTimes.push(hoursDiff);
          }
        }
      });

      const averageDeliveryTime = deliveryTimes.length > 0
        ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
        : 0;

      // Eficiencia (porcentaje de entregadas)
      const efficiency = totalOrders > 0
        ? (deliveredOrders.length / totalOrders) * 100
        : 0;

      // Rutas asignadas (órdenes con courier asignado)
      const assignedRoutes = orders.filter((el: any) => el.courier && el.courier.full_name).length;

      // Rendimiento por tipo de vehículo
      const performanceByVehicle: Record<string, any> = {};
      orders.forEach((order: any) => {
        const vehicleType = order.courier?.vehicle_type || 'Sin asignar';
        if (!performanceByVehicle[vehicleType]) {
          performanceByVehicle[vehicleType] = {
            vehicle_type: vehicleType,
            total: 0,
            delivered: 0,
            efficiency: 0,
          };
        }
        performanceByVehicle[vehicleType].total++;
        if (order.status === StatusEnum.delivered) {
          performanceByVehicle[vehicleType].delivered++;
        }
      });

      // Calcular eficiencia por vehículo
      Object.keys(performanceByVehicle).forEach((key) => {
        const perf = performanceByVehicle[key];
        perf.efficiency = perf.total > 0
          ? (perf.delivered / perf.total) * 100
          : 0;
      });

      const dataReport = {
        totalOrders,
        deliveredOrders: deliveredOrders.length,
        averageDeliveryTime: Math.round(averageDeliveryTime * 100) / 100, // 2 decimales
        averageDeliveryTimeHours: Math.floor(averageDeliveryTime),
        averageDeliveryTimeMinutes: Math.round((averageDeliveryTime % 1) * 60),
        efficiency: Math.round(efficiency * 100) / 100, // 2 decimales
        assignedRoutes,
        performanceByVehicle: Object.values(performanceByVehicle),
      };

      return {
        success: true,
        data: dataReport,
        message: 'Performance report',
      };
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
        error: true,
      });
    }
  }

  async generateInvoices(generateInvoicesDto: GenerateInvoicesDto) {
    try {
      const orders = await this.repository.findOrdersByArrayIds(
        generateInvoicesDto.ordersIds,
      );

      if (!orders || orders.length === 0) {
        throw new RpcException({
          message: 'No orders found with the provided IDs',
          status: HttpStatus.NOT_FOUND,
          error: true,
        });
      }

      const job = await this.invoicesQueue.add('generate', generateInvoicesDto, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      return {
        success: true,
        message: 'Invoice generation started',
        data: {
          job_id: job.id,
          orders_count: orders.length,
          status: 'processing',
        },
      };
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
        error: true,
      });
    }
  }
}

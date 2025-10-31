import * as fs from 'fs';
import * as path from 'path';
import * as PdfPrinter from 'pdfmake';
import { firstValueFrom } from 'rxjs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { envs } from 'src/configuration';
import { ClientProxy } from '@nestjs/microservices';
import { CloudinaryService } from 'src/commons/cloudinary/cloudinary.service';
import { OrdersRepository } from '../repository/orders.repository';
import { GenerateReportPdfDto, ReportType } from '../dto/generate-report-pdf.dto';

@Injectable()
export class ReportPdfService {
  private readonly logger = new Logger(ReportPdfService.name);

  constructor(
    @Inject() private readonly repository: OrdersRepository,
    @Inject() private readonly cloudinary: CloudinaryService,
    @Inject(envs.nats_service_name) private readonly client: ClientProxy,
  ) {}

  async generateDiaryReportPdf(data: GenerateReportPdfDto): Promise<string> {
    try {
      // Construir query
      const andConditions: any[] = [{ parent_id: data.parent_id }];

      if (data.date) {
        const date = new Date(data.date);
        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));
        andConditions.push({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
      }

      if (data.courier) {
        const searchRegex = new RegExp(data.courier as string, 'i');
        andConditions.push({
          $or: [
            { 'courier.full_name': searchRegex },
            { 'courier.vehicle_type': searchRegex },
            { 'courier.license_plate': searchRegex },
          ],
        });
      }

      const query: Record<string, any> = { $and: andConditions };
      const orders = await this.repository.diaryReport(query) as any;

      // Obtener configuración
      const { configuration } = await firstValueFrom(
        this.client.send('find-configuration', data.parent_id),
      );

      // Calcular estadísticas
      const delivared = orders.filter((el: any) => el.status === 'delivered').length;
      const printed = orders.filter((el: any) => el.status === 'guide-printed').length;
      const pending = orders.filter((el: any) => el.status === 'pending').length;
      const cancelled = orders.filter((el: any) => el.status === 'cancelled').length;
      const news = orders.filter((el: any) => el.status === 'guide_news').length;
      const inProgress = orders.filter((el: any) => el.status === 'in_progress').length;
      const totalCashAmount = orders.reduce(
        (acc: number, order: any) => acc + parseFloat((order.cash_amount || '0').toString().replace('.', '')),
        0,
      );
      const totalCollected = orders.reduce(
        (acc: number, order: any) => acc + parseFloat(order.collected || '0'),
        0,
      );
      const pendingToCollect = totalCashAmount - totalCollected;

      // Generar PDF
      const fonts = {
        Helvetica: {
          normal: 'Helvetica',
          bold: 'Helvetica-Bold',
          italics: 'Helvetica-Oblique',
          bolditalics: 'Helvetica-BoldOblique',
        },
      };

      const printer = new PdfPrinter(fonts);
      const currency = configuration?.currency || 'COP';

      const docDefinition: any = {
        pageSize: 'A4',
        pageMargins: [40, 80, 40, 60],
        defaultStyle: { font: 'Helvetica', fontSize: 10 },
        header: {
          text: 'REPORTE DIARIO DE ÓRDENES',
          style: 'header',
          alignment: 'center',
          margin: [0, 20, 0, 20],
        },
        content: [
          // Información del reporte
          {
            text: `Fecha: ${data.date || new Date().toLocaleDateString('es-CO')}`,
            style: 'subheader',
            margin: [0, 0, 0, 10],
          },
          ...(data.courier ? [{
            text: `Courier: ${data.courier}`,
            style: 'subheader',
            margin: [0, 0, 0, 10],
          }] : []),

          // Estadísticas
          {
            table: {
              widths: ['*', '*', '*', '*', '*', '*', '*'],
              body: [
                [
                  { text: 'Total', style: 'tableHeader' },
                  { text: 'Entregadas', style: 'tableHeader' },
                  { text: 'Pendientes', style: 'tableHeader' },
                  { text: 'En Progreso', style: 'tableHeader' },
                  { text: 'Canceladas', style: 'tableHeader' },
                  { text: 'Impresas', style: 'tableHeader' },
                  { text: 'Novedades', style: 'tableHeader' },
                ],
                [
                  { text: orders.length.toString(), style: 'tableCell', alignment: 'center' },
                  { 
                    text: `${delivared.toString()} (${orders.length > 0 ? ((delivared / orders.length) * 100).toFixed(1) : '0'}%)`, 
                    style: 'tableCell', 
                    alignment: 'center' 
                  },
                  { 
                    text: `${pending.toString()} (${orders.length > 0 ? ((pending / orders.length) * 100).toFixed(1) : '0'}%)`, 
                    style: 'tableCell', 
                    alignment: 'center' 
                  },
                  { 
                    text: `${inProgress.toString()} (${orders.length > 0 ? ((inProgress / orders.length) * 100).toFixed(1) : '0'}%)`, 
                    style: 'tableCell', 
                    alignment: 'center' 
                  },
                  { 
                    text: `${cancelled.toString()} (${orders.length > 0 ? ((cancelled / orders.length) * 100).toFixed(1) : '0'}%)`, 
                    style: 'tableCell', 
                    alignment: 'center' 
                  },
                  { 
                    text: `${printed.toString()} (${orders.length > 0 ? ((printed / orders.length) * 100).toFixed(1) : '0'}%)`, 
                    style: 'tableCell', 
                    alignment: 'center' 
                  },
                  { 
                    text: `${news.toString()} (${orders.length > 0 ? ((news / orders.length) * 100).toFixed(1) : '0'}%)`, 
                    style: 'tableCell', 
                    alignment: 'center' 
                  },
                ],
              ],
            },
            margin: [0, 0, 0, 20],
          },

          // Totales monetarios
          {
            table: {
              widths: ['*', '*', '*'],
              body: [
                [
                  { text: 'Total a recaudar', style: 'tableHeader' },
                  { text: 'Total recaudado', style: 'tableHeader' },
                  { text: 'Pendiente', style: 'tableHeader' },
                ],
                [
                  { text: this.formatCurrency(totalCashAmount), style: 'tableCell', alignment: 'center' },
                  { text: this.formatCurrency(totalCollected), style: 'tableCell', alignment: 'center' },
                  { text: this.formatCurrency(pendingToCollect), style: 'tableCellBold', alignment: 'center' },
                ],
              ],
            },
            margin: [0, 0, 0, 20],
          },

          // Tabla de órdenes
          {
            text: 'DETALLE DE ÓRDENES',
            style: 'subheader',
            margin: [0, 10, 0, 10],
          },
          {
            table: {
              headerRows: 1,
              widths: ['*', '*', '*', '*', '*', '*', '*', '*'],
              body: [
                [
                  { text: 'Referencia', style: 'tableHeaderLeft' },
                  { text: 'Remitente', style: 'tableHeaderLeft' },
                  { text: 'Cliente', style: 'tableHeaderLeft' },
                  { text: 'Estado', style: 'tableHeaderLeft' },
                  { text: 'A recaudar', style: 'tableHeader', alignment: 'center' },
                  { text: 'Pendiente', style: 'tableHeader', alignment: 'center' },
                  { text: 'Recaudado', style: 'tableHeader', alignment: 'center' },
                  { text: 'Precio', style: 'tableHeader', alignment: 'center' },
                ],
                ...orders.slice(0, 50).map((order: any) => {
                  const cashAmount = parseFloat((order.cash_amount?.toString().replace('.', '') || '0'));
                  const collected = parseFloat(order.collected || '0');
                  const pendingPerOrder = cashAmount - collected;
                  
                  return [
                    { text: order.reference || '', style: 'tableCellLeft', fontSize: 8 },
                    { text: order.sender_name || '', style: 'tableCellLeft', fontSize: 8 },
                    { text: order.client_name || '', style: 'tableCellLeft', fontSize: 8 },
                    { text: this.getStatusText(order.status), style: 'tableCellLeft', fontSize: 8 },
                    { text: this.formatCurrency(cashAmount), style: 'tableCell', fontSize: 8, alignment: 'center' },
                    { text: this.formatCurrency(pendingPerOrder), style: 'tableCell', fontSize: 8, alignment: 'center' },
                    { text: this.formatCurrency(collected), style: 'tableCell', fontSize: 8, alignment: 'center' },
                    { text: this.formatCurrency(parseFloat(order.order_price || '0')), style: 'tableCell', fontSize: 8, alignment: 'center' },
                  ];
                }),
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#aaa',
              vLineColor: () => '#aaa',
            },
          },
          // Nota sobre moneda
          {
            text: `Nota: Todos los montos están expresados en ${currency}.`,
            style: 'note',
            margin: [0, 20, 0, 10],
            alignment: 'justify',
            italics: true,
          },
        ],
        styles: {
          header: {
            fontSize: 18,
            bold: true,
          },
          subheader: {
            fontSize: 12,
            bold: true,
          },
          tableHeader: {
            bold: true,
            fontSize: 9,
            color: 'black',
            fillColor: '#eeeeee',
            alignment: 'center',
          },
          tableHeaderLeft: {
            bold: true,
            fontSize: 9,
            color: 'black',
            fillColor: '#eeeeee',
            alignment: 'left',
          },
          tableCell: {
            fontSize: 9,
          },
          tableCellLeft: {
            fontSize: 9,
            alignment: 'left',
          },
          tableCellBold: {
            fontSize: 9,
            bold: true,
          },
          note: {
            fontSize: 8,
            color: '#666',
          },
        },
        footer: (currentPage: number, pageCount: number) => ({
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 9,
          margin: [0, 10, 0, 0],
        }),
      };

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const filePath = path.join(
        process.cwd(),
        `pdfs/report-diary-${data.parent_id}-${Date.now()}.pdf`,
      );

      // Crear directorio si no existe
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const writeStream = fs.createWriteStream(filePath);
      pdfDoc.pipe(writeStream);
      pdfDoc.end();

      // Esperar a que se escriba el archivo
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => {
          setTimeout(() => resolve(), 500);
        });
        writeStream.on('error', reject);
        pdfDoc.on('error', reject);
      });

      return filePath;
    } catch (error) {
      this.logger.error(`Error generating diary report PDF: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateLiquidationReportPdf(data: GenerateReportPdfDto): Promise<string> {
    try {
      // Obtener datos del reporte de liquidación
      const searchRegex = new RegExp(data.sender || '', 'i');
      const andConditions: any[] = [{
        settled_to_sender: true,
        'sender.brand_name': searchRegex,
        parent_id: data.parent_id,
        cash_on_delivery: true,
      }];

      let startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
      let endOfDay = new Date(new Date().setHours(23, 59, 59, 999));

      if (data.from && data.to) {
        const from = new Date(data.from);
        const to = new Date(data.to);
        startOfDay = new Date(from.setHours(0, 0, 0, 0));
        endOfDay = new Date(to.setHours(23, 59, 59, 999));
        andConditions.push({ settled_date: { $gte: startOfDay, $lte: endOfDay } });
      }

      const query: Record<string, any> = { $and: andConditions };

      // Obtener sender para comisión
      const { data: senderData } = await firstValueFrom(
        this.client.send('get-sender-by-name', {
          name: data.sender,
          parent_id: data.parent_id,
        }),
      );

      let porcentageComission = 0;
      if (senderData) {
        porcentageComission = senderData.sender_info?.comission_porcent || 0;
      }

      // Obtener órdenes usando el repository directamente
      const orders = await this.repository.liquidationReport(query, porcentageComission) as any;
      
      const ordersNoSettled = await this.repository.countOrdersByQuery({
        settled_to_sender: false,
        'sender.brand_name': searchRegex,
        parent_id: data.parent_id,
        settled_date: { $gte: startOfDay, $lte: endOfDay },
      });

      const totalComission = orders.reduce(
        (acc: number, order: any) => acc + parseFloat(order.comission || '0'),
        0,
      );
      const totalLiquidate = orders.reduce(
        (acc: number, order: any) => acc + parseFloat(order.total_to_liquidate || '0'),
        0,
      );
      const totalCollection = orders.reduce(
        (acc: number, order: any) => acc + parseFloat(order.cash_amount?.replace('.', '') || '0'),
        0,
      );

      // Obtener configuración
      const { configuration } = await firstValueFrom(
        this.client.send('find-configuration', data.parent_id),
      );

      const currency = configuration?.currency || 'COP';

      // Generar PDF
      const fonts = {
        Helvetica: {
          normal: 'Helvetica',
          bold: 'Helvetica-Bold',
          italics: 'Helvetica-Oblique',
          bolditalics: 'Helvetica-BoldOblique',
        },
      };

      const printer = new PdfPrinter(fonts);

      const docDefinition: any = {
        pageSize: 'A4',
        pageMargins: [40, 80, 40, 60],
        defaultStyle: { font: 'Helvetica', fontSize: 10 },
        header: {
          text: 'REPORTE DE LIQUIDACIÓN',
          style: 'header',
          alignment: 'center',
          margin: [0, 20, 0, 20],
        },
        content: [
          {
            text: `Remitente: ${data.sender}`,
            style: 'subheader',
            margin: [0, 0, 0, 10],
          },
          {
            text: `Período: ${data.from ? new Date(data.from).toLocaleDateString('es-CO') : ''} - ${data.to ? new Date(data.to).toLocaleDateString('es-CO') : ''}`,
            style: 'subheader',
            margin: [0, 0, 0, 20],
          },

          // Estadísticas
          {
            table: {
              widths: ['*', '*', '*', '*', '*'],
              body: [
                [
                  { text: 'Liquidadas', style: 'tableHeader' },
                  { text: 'No Liquidadas', style: 'tableHeader' },
                  { text: 'Comisión', style: 'tableHeader' },
                  { text: 'Total recaudado', style: 'tableHeader' },
                  { text: 'Total Liquidar', style: 'tableHeader' },
                ],
                [
                  { text: orders.length.toString(), style: 'tableCell', alignment: 'center' },
                  { text: ordersNoSettled.toString(), style: 'tableCell', alignment: 'center' },
                  { text: this.formatCurrency(totalComission), style: 'tableCell', alignment: 'center' },
                  { text: this.formatCurrency(totalCollection), style: 'tableCell', alignment: 'center' },
                  { text: this.formatCurrency(totalLiquidate), style: 'tableCell', alignment: 'center' },
                ],
              ],
            },
            margin: [0, 0, 0, 20],
          },

          // Tabla de órdenes
          {
            text: 'DETALLE DE ÓRDENES LIQUIDADAS',
            style: 'subheader',
            margin: [0, 10, 0, 10],
          },
          {
            table: {
              headerRows: 1,
              widths: ['*', '*', '*', '*', '*', '*', '*', '*'],
              body: [
                [
                  { text: 'Referencia', style: 'tableHeader' },
                  { text: 'Remitente', style: 'tableHeader' },
                  { text: 'Cliente', style: 'tableHeader' },
                  { text: 'A recaudar', style: 'tableHeader', alignment: 'center' },
                  { text: 'Recaudado', style: 'tableHeader', alignment: 'center' },
                  { text: 'Comisión', style: 'tableHeader', alignment: 'center' },
                  { text: 'Liquidar', style: 'tableHeader', alignment: 'center' },
                  { text: 'Estado', style: 'tableHeader' },
                ],
                ...orders.slice(0, 50).map((order: any) => [
                  { text: order.reference || '', style: 'tableCell', fontSize: 8 },
                  { text: order.sender_name || '', style: 'tableCell', fontSize: 8 },
                  { text: order.client_name || '', style: 'tableCell', fontSize: 8 },
                  { text: this.formatCurrency(parseFloat(order.cash_amount?.replace('.', '') || '0')), style: 'tableCell', fontSize: 8, alignment: 'center' },
                  { text: this.formatCurrency(parseFloat(order.collected || '0')), style: 'tableCell', fontSize: 8, alignment: 'center' },
                  { text: this.formatCurrency(parseFloat(order.comission || '0')), style: 'tableCell', fontSize: 8, alignment: 'center' },
                  { text: this.formatCurrency(parseFloat(order.total_to_liquidate || '0')), style: 'tableCell', fontSize: 8, alignment: 'center' },
                  { text: this.getStatusText(order.status), style: 'tableCell', fontSize: 8 },
                ]),
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#aaa',
              vLineColor: () => '#aaa',
            },
          },
          // Nota sobre moneda
          {
            text: `Nota: Todos los montos están expresados en ${currency}.`,
            style: 'note',
            margin: [0, 20, 0, 10],
            alignment: 'justify',
            italics: true,
          },
        ],
        styles: {
          header: {
            fontSize: 18,
            bold: true,
          },
          subheader: {
            fontSize: 12,
            bold: true,
          },
          tableHeader: {
            bold: true,
            fontSize: 9,
            color: 'black',
            fillColor: '#eeeeee',
            alignment: 'center',
          },
          tableCell: {
            fontSize: 9,
          },
          note: {
            fontSize: 8,
            color: '#666',
          },
        },
        footer: (currentPage: number, pageCount: number) => ({
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 9,
          margin: [0, 10, 0, 0],
        }),
      };

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const filePath = path.join(
        process.cwd(),
        `pdfs/report-liquidation-${data.parent_id}-${Date.now()}.pdf`,
      );

      // Crear directorio si no existe
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const writeStream = fs.createWriteStream(filePath);
      pdfDoc.pipe(writeStream);
      pdfDoc.end();

      // Esperar a que se escriba el archivo
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => {
          setTimeout(() => resolve(), 500);
        });
        writeStream.on('error', reject);
        pdfDoc.on('error', reject);
      });

      return filePath;
    } catch (error) {
      this.logger.error(`Error generating liquidation report PDF: ${error.message}`, error.stack);
      throw error;
    }
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      pending: 'Pendiente',
      in_progress: 'En Progreso',
      delivered: 'Entregada',
      cancelled: 'Cancelada',
      returned: 'Devuelta',
      'guide-printed': 'Guía Impresa',
      guide_news: 'Novedad',
    };
    return statusMap[status] || status;
  }
}


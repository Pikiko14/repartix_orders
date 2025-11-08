import * as fs from 'fs';
import * as path from 'path';
import * as PdfPrinter from 'pdfmake';
import { firstValueFrom } from 'rxjs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { envs } from 'src/configuration';
import { ClientProxy } from '@nestjs/microservices';
import { OrdersRepository } from '../repository/orders.repository';
import { GenerateInvoicesDto } from '../dto/generate-invoices.dto';

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    @Inject() private readonly repository: OrdersRepository,
    @Inject(envs.nats_service_name) private readonly client: ClientProxy,
  ) {}

  async generateInvoicePdf(data: GenerateInvoicesDto): Promise<string> {
    try {
      const orders = await this.repository.findOrdersByArrayIds(data.ordersIds);

      if (!orders || orders.length === 0) {
        throw new Error('No orders found');
      }

      const { configuration } = await firstValueFrom(
        this.client.send('find-configuration', data.parent_id),
      );

      const groupedBySender = this.groupOrdersBySender(orders);

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

      const invoiceContent: any[] = [];
      const invoiceNumber = `INV-${Date.now()}`;
      const invoiceDate = new Date().toLocaleDateString('es-CO');

      for (const [senderName, senderOrders] of Object.entries(groupedBySender)) {
        const totalAmount = senderOrders.reduce((acc, order) => {
          const orderPrice = parseFloat(order.order_price?.toString() || '0');
          const discount = parseFloat(order.discount?.toString() || '0');
          return acc + (orderPrice - discount);
        }, 0);

        const sender = senderOrders[0].sender;
        const senderInfo = await this.getSenderInfo(sender.sender_id, data.parent_id, sender.brand_name);

        if (invoiceContent.length > 0) {
          invoiceContent.push({ text: '', pageBreak: 'before' });
        }

        invoiceContent.push(
          {
            columns: [
              {
                text: [
                  { text: 'Factura No: ', bold: true },
                  { text: `${invoiceNumber}-${senderName.substring(0, 6).toUpperCase()}` },
                ],
                width: '50%',
              },
              {
                text: [
                  { text: 'Fecha: ', bold: true },
                  { text: invoiceDate },
                ],
                width: '50%',
                alignment: 'right',
              },
            ],
            margin: [0, 0, 0, 20],
          },
          {
            text: 'DATOS DEL REMITENTE',
            style: 'subheader',
            margin: [0, 0, 0, 10],
          },
          {
            table: {
              widths: ['*'],
              body: (() => {
                const rows = [
                  [
                    {
                      text: [
                        { text: 'Nombre: ', bold: true },
                        { text: sender.brand_name || '' },
                      ],
                    },
                  ],
                  [
                    {
                      text: [
                        { text: 'Teléfono: ', bold: true },
                        { text: sender.brand_phone || '' },
                      ],
                    },
                  ],
                ];

                if (senderInfo?.rut) {
                  rows.push([
                    {
                      text: [
                        { text: 'RUT/NIT: ', bold: true },
                        { text: senderInfo.rut },
                      ],
                    },
                  ]);
                }

                if (sender?.address?.address) {
                  rows.push([
                    {
                      text: [
                        { text: 'Dirección: ', bold: true },
                        { text: sender.address.address },
                      ],
                    },
                  ]);
                }

                return rows;
              })(),
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 20],
          },
            {
              text: 'DETALLE DE ÓRDENES',
              style: 'subheader',
              margin: [0, 0, 0, 10],
            },
            {
              table: {
                headerRows: 1,
                widths: ['15%', '20%', '25%', '20%', '20%'],
                body: [
                  [
                    { text: 'Referencia', bold: true, fillColor: '#eeeeee' },
                    { text: 'Fecha', bold: true, fillColor: '#eeeeee' },
                    { text: 'Cliente', bold: true, fillColor: '#eeeeee' },
                    { text: 'Precio', bold: true, fillColor: '#eeeeee', alignment: 'right' },
                    { text: 'Descuento', bold: true, fillColor: '#eeeeee', alignment: 'right' },
                  ],
                  ...senderOrders.map((order) => [
                    order.reference || '',
                    new Date(order.createdAt || order.date).toLocaleDateString('es-CO'),
                    `${order.client?.name || ''} ${order.client?.last_name || ''}`,
                    {
                      text: this.formatCurrency(order.order_price || 0, currency),
                      alignment: 'right',
                    },
                    {
                      text: this.formatCurrency(order.discount || 0, currency),
                      alignment: 'right',
                    },
                  ]),
                ],
              },
              margin: [0, 0, 0, 20],
            },
            {
              table: {
                widths: ['*', '30%'],
                body: [
                  [
                    { text: 'TOTAL A COBRAR', bold: true, fontSize: 12 },
                    {
                      text: this.formatCurrency(totalAmount, currency),
                      bold: true,
                      fontSize: 12,
                      alignment: 'right',
                    },
                  ],
                ],
              },
              layout: 'noBorders',
              margin: [0, 0, 0, 20],
            },
          {
            text: 'NOTAS',
            style: 'subheader',
            margin: [0, 20, 0, 10],
          },
          {
            text: 'Esta factura corresponde al cobro por los servicios de entrega de las órdenes detalladas anteriormente.',
            margin: [0, 0, 0, 10],
          },
        );
      }

      const docDefinition: any = {
        pageSize: 'A4',
        pageMargins: [40, 80, 40, 60],
        defaultStyle: { font: 'Helvetica', fontSize: 10 },
        header: {
          text: 'FACTURAS DE COBRO',
          style: 'header',
          alignment: 'center',
          margin: [0, 20, 0, 20],
        },
        content: invoiceContent,
        styles: {
          header: {
            fontSize: 18,
            bold: true,
          },
          subheader: {
            fontSize: 14,
            bold: true,
          },
        },
      };

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const filePath = path.join(
        tempDir,
        `invoice-${invoiceNumber}-${Date.now()}.pdf`,
      );

      const writeStream = fs.createWriteStream(filePath);
      pdfDoc.pipe(writeStream);
      pdfDoc.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      return filePath;
    } catch (error) {
      this.logger.error(`Error generating invoice PDF: ${error.message}`, error.stack);
      throw error;
    }
  }

  private groupOrdersBySender(orders: any[]): Record<string, any[]> {
    return orders.reduce((acc, order) => {
      const senderName = order.sender?.brand_name || 'Unknown';
      if (!acc[senderName]) {
        acc[senderName] = [];
      }
      acc[senderName].push(order);
      return acc;
    }, {} as Record<string, any[]>);
  }

  private async getSenderInfo(senderId: string, parentId: string, brandName: string): Promise<any> {
    try {
      const { data } = await firstValueFrom(
        this.client.send('get-sender-by-name', {
          name: brandName,
          parent_id: parentId,
        }),
      );
      return data?.sender_info || null;
    } catch (error) {
      this.logger.warn(`Could not fetch sender info: ${error.message}`);
      return null;
    }
  }

  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency === 'COP' ? 'COP' : 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  }
}


import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Job } from 'bull';
import { Inject, Logger } from '@nestjs/common';
import { envs } from 'src/configuration';
import { ClientProxy } from '@nestjs/microservices';
import { CloudinaryService } from 'src/commons/cloudinary/cloudinary.service';
import { InvoicePdfService } from '../services/invoice-pdf.service';
import { GenerateInvoicesDto } from '../dto/generate-invoices.dto';
import { OrdersRepository } from '../repository/orders.repository';
import { CacheService } from 'src/commons/cache/cache.service';
import * as fs from 'fs';

@Processor('invoices')
export class InvoicePdfProcessor {
  private readonly logger = new Logger(InvoicePdfProcessor.name);

  constructor(
    @Inject() private readonly cloudinary: CloudinaryService,
    @Inject() private readonly invoicePdfService: InvoicePdfService,
    @Inject() private readonly repository: OrdersRepository,
    @Inject() private readonly cacheService: CacheService,
    @Inject(envs.nats_service_name) private readonly client: ClientProxy,
  ) {}

  @Process('generate')
  async handlerGenerate(job: Job<GenerateInvoicesDto>) {
    try {
      return await this.generateInvoicePdf(job.data);
    } catch (error) {
      this.logger.error(`Error generating invoice PDF: ${error.message}`, error.stack);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(
      `📄 Job ${job.id} - Generating invoice PDF for ${job.data.ordersIds.length} orders...`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(
      `✅ Job ${job.id} - Invoice PDF completed. URL: ${result?.pdf_url}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<any>, error: any) {
    this.logger.error(
      `❌ Job ${job.id} - Invoice PDF failed:`,
      error,
    );
  }

  async generateInvoicePdf(data: GenerateInvoicesDto) {
    try {
      const pdfPath = await this.invoicePdfService.generateInvoicePdf(data);

      const folder = `invoices/${new Date().getMonth() + 1}-${new Date().getFullYear()}`;
      const filename = `invoice-${data.parent_id}-${Date.now()}.pdf`;

      const cloudinaryResult = await this.cloudinary.uploadFilePath(
        pdfPath,
        folder,
        filename,
      );

      if (!cloudinaryResult?.secure_url) {
        throw new Error('Failed to upload PDF to Cloudinary');
      }

      await this.repository.markOrdersAsInvoiced(data.ordersIds);

      await this.cacheService.removeByPrefix(
        `keyv:${data.parent_id}:orders:list`,
      );

      const orders = await this.repository.findOrdersByArrayIds(data.ordersIds);
      const senderNames = [...new Set(orders.map(order => order.sender?.brand_name).filter(Boolean))];
      const senderNamesText = senderNames.length > 0 
        ? senderNames.length === 1 
          ? senderNames[0]
          : `${senderNames[0]}${senderNames.length > 1 ? ` y ${senderNames.length - 1} más` : ''}`
        : 'remitente';

      this.client.emit('create-websocket-notification', {
        success: true,
        data: { pdf: cloudinaryResult.secure_url, model_id: `invoice-${data.parent_id}-${Date.now()}` },
        room: `${data.user_request_id}-${data.parent_id}`,
        model: 'orders',
      });

      this.client.emit('create-internal-notification', {
        parent_id: data.parent_id,
        room: `admin-${data.parent_id}`,
        type: 'invoice_pdf_generated',
        title: `Factura PDF Generada`,
        message: `La factura de cobro para ${senderNamesText} está lista para descargar`,
        metadata: {
          pdf_url: cloudinaryResult.secure_url,
          filename: filename,
          orders_count: data.ordersIds.length,
          sender_names: senderNames,
          generated_at: new Date().toISOString(),
        },
        priority: 'high',
      });

      setTimeout(() => {
        try {
          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
          }
        } catch (err) {
          this.logger.warn(`Could not delete temporary file: ${pdfPath}`);
        }
      }, 3000);

      return {
        success: true,
        pdf_url: cloudinaryResult.secure_url,
        filename: filename,
      };
    } catch (error) {
      this.logger.error(`Error in generateInvoicePdf: ${error.message}`, error.stack);
      throw error;
    }
  }
}


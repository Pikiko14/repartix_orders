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
import { ReportPdfService } from '../services/report-pdf.service';
import { GenerateReportPdfDto, ReportType } from '../dto/generate-report-pdf.dto';

@Processor('reports')
export class ReportPdfProcessor {
  private readonly logger = new Logger(ReportPdfProcessor.name);

  constructor(
    @Inject() private readonly cloudinary: CloudinaryService,
    @Inject() private readonly reportPdfService: ReportPdfService,
    @Inject(envs.nats_service_name) private readonly client: ClientProxy,
  ) {}

  @Process('generate')
  async handlerGenerate(job: Job<GenerateReportPdfDto>) {
    try {
      return await this.generateReportPdf(job.data);
    } catch (error) {
      this.logger.error(`Error generating report PDF: ${error.message}`, error.stack);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(
      `📄 Job ${job.id} - Generating ${job.data.report_type} report PDF...`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(
      `✅ Job ${job.id} - ${job.data.report_type} report PDF completed. URL: ${result?.pdf_url}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<any>, error: any) {
    this.logger.error(
      `❌ Job ${job.id} - ${job.data.report_type} report PDF failed:`,
      error,
    );
  }

  async generateReportPdf(data: GenerateReportPdfDto) {
    try {
      // Generar el PDF según el tipo de reporte
      let pdfPath: string;
      
      if (data.report_type === ReportType.DIARY) {
        pdfPath = await this.reportPdfService.generateDiaryReportPdf(data);
      } else if (data.report_type === ReportType.LIQUIDATION) {
        pdfPath = await this.reportPdfService.generateLiquidationReportPdf(data);
      } else if (data.report_type === ReportType.PERFORMANCE) {
        pdfPath = await this.reportPdfService.generatePerformanceReportPdf(data);
      } else {
        throw new Error(`Unknown report type: ${data.report_type}`);
      }

      // Subir a Cloudinary
      const folder = `reports/${new Date().getMonth() + 1}-${new Date().getFullYear()}`;
      const filename = `report-${data.report_type}-${data.parent_id}-${Date.now()}.pdf`;
      
      const cloudinaryResult = await this.cloudinary.uploadFilePath(
        pdfPath,
        folder,
        filename,
      );

      if (!cloudinaryResult?.secure_url) {
        throw new Error('Failed to upload PDF to Cloudinary');
      }

      // Enviar notificación interna (esta también envía por socket)
      this.client.emit('create-internal-notification', {
        parent_id: data.parent_id,
        room: `admin-${data.parent_id}`,
        type: 'report_pdf_generated',
        title: `Reporte PDF Generado`,
        message: `El reporte ${data.report_type === ReportType.DIARY ? 'diario' : data.report_type === ReportType.LIQUIDATION ? 'de liquidación' : 'de rendimiento'} está listo para descargar`,
        metadata: {
          pdf_url: cloudinaryResult.secure_url,
          report_type: data.report_type,
          filename: filename,
          generated_at: new Date().toISOString(),
        },
        priority: 'high',
      });

      // Eliminar archivo temporal
      const fs = require('fs');
      setTimeout(() => {
        try {
          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
          }
        } catch (err) {
          this.logger.warn(`Could not delete temporary file: ${pdfPath}`);
        }
      }, 1000);

      return {
        success: true,
        pdf_url: cloudinaryResult.secure_url,
        filename: filename,
      };
    } catch (error) {
      this.logger.error(`Error in generateReportPdf: ${error.message}`, error.stack);
      throw error;
    }
  }
}


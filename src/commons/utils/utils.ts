import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class Utils {
  logger = new Logger(Utils.name);

  constructor(
    @Inject() private readonly cloudinary: CloudinaryService,
  ) {}

  getMonthRange(date: Date) {
    // Inicio de mes
    const startOfMonth = new Date(
      date.getFullYear(),
      date.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );
    // Fin de mes
    const endOfMonth = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { startOfMonth, endOfMonth };
  }

  async processFile(file: any) {
    const { filename, buffer } = file;

    const fileBuffer = Buffer.from(buffer, 'base64');

    // Carpeta destino (en la raíz del proyecto)
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Guardar en disco
    const basename = path.parse(filename).name;
    const savePath = path.join(uploadDir, `${basename}.webp`);

    // Convertir a WebP con sharp
    await sharp(fileBuffer)
      .webp({ quality: 50 })
      .toFile(savePath);

    try {
      const cloudinaryResponse = await this.cloudinary.uploadFilePath(
        savePath,
         `payments/${new Date().getMonth() + 1}-${new Date().getFullYear()}`,
         basename,
      );

      if (cloudinaryResponse && cloudinaryResponse?.secure_url) {
        
        return cloudinaryResponse?.secure_url;
      }

      await fs.promises.unlink(savePath);

      return null;
    } catch (error) {
      this.logger.error(error);
    };
  }
}

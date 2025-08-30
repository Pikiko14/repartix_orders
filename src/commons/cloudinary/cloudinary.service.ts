// src/cloudinary/cloudinary.service.ts
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import * as fs from 'fs';
import { envs } from 'src/configuration';
import { Injectable } from '@nestjs/common';

cloudinary.config({
  cloud_name: envs.cloudinary_cloud_name,
  api_key: envs?.cloudinary_api_key,
  api_secret: envs?.cloudinary_api_secret,
});

@Injectable()
export class CloudinaryService {
  /**
   * Sube un buffer de archivo a Cloudinary.
   * @param fileBuffer - El buffer del archivo a subir.
   * @param folder - Carpeta en la que se guardará el archivo.
   * @param filename file name
   * @returns Promesa con la respuesta de Cloudinary.
   */
  async uploadPdf(
    fileBuffer: Buffer,
    folder: string,
    filename: string,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            use_filename: true,
            filename_override: filename,
            type: 'upload',
            access_mode: 'public',
          },
          (error: any, result: any) => {
            if (error) {
              console.log(error)
              return reject(error);
            };
            resolve(result);
          },
        )
        .end(fileBuffer);
    });
  }

  /**
   * Sube un archivo local (ejemplo PDF o imagen) a Cloudinary.
   * @param filePath - Ruta absoluta del archivo a subir.
   * @param folder - Carpeta en la que se guardará.
   *
   */
  async uploadFilePath(
    filePath: string,
    folder: string,
    filename: string,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    const fileBuffer = await fs.promises.readFile(filePath);
    return this.uploadPdf(fileBuffer, folder, filename);
  }

  /**
   * Elimina una imagen de Cloudinary usando su URL.
   * @param imageUrl - La URL completa de la imagen en Cloudinary.
   * @returns Promesa con el resultado de la eliminación.
   */
  async deleteFile(imageUrl: string): Promise<any> {
    // Extraer el public_id de la URL de Cloudinary
    const publicId = this.extractPublicId(imageUrl);

    if (!publicId) {
      return false;
    }

    const clearId = imageUrl.split(publicId);
    const publicIdCleared = clearId[1].substring(1).split('.')[0];

    return new Promise((resolve, reject) => {
      const result = cloudinary.api.delete_resources([publicIdCleared], {
        type: 'upload',
        resource_type: 'image',
      });
      resolve(result);
    });
  }

  /**
   * Extrae el public_id de la URL de Cloudinary.
   * @param url - La URL de la imagen de Cloudinary.
   * @returns El public_id extraído.
   */
  private extractPublicId(url: string): string | null {
    const regex = /upload\/([^\/?]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }
}

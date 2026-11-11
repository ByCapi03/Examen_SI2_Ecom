import { Injectable, BadRequestException, BadGatewayException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly configured: boolean;

  constructor(private configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY')?.trim();
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET')?.trim();
    this.configured = !!(cloudName && apiKey && apiSecret);

    if (this.configured) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    } else {
      this.logger.warn('Cloudinary sin configurar: no se podrán subir imágenes. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en backend/.env');
    }
  }

  isConfigured() {
    return this.configured;
  }

  private assertConfigured() {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'El almacenamiento de imágenes (Cloudinary) no está configurado. Agrega CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en backend/.env y reinicia el backend.',
      );
    }
  }

  /** Traduce los errores del SDK a mensajes comprensibles. */
  private toHttpError(err: any) {
    const message: string = err?.message ?? String(err);
    this.logger.error(`Error de Cloudinary: ${message}`);
    if (/invalid.*(api_key|signature|cloud_name|credentials)|unknown api key|cloud_name mismatch|must supply/i.test(message) || [401, 403].includes(err?.http_code)) {
      return new BadGatewayException('Cloudinary rechazó las credenciales. Revisa CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en backend/.env (sin comillas ni espacios) y reinicia el backend.');
    }
    if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|timeout/i.test(`${message} ${err?.code ?? ''}`)) {
      return new BadGatewayException('No se pudo conectar con Cloudinary. Revisa la conexión a Internet del servidor.');
    }
    return new BadGatewayException(`No se pudo subir la imagen a Cloudinary: ${message}`);
  }

  async uploadImage(file: any): Promise<UploadApiResponse | UploadApiErrorResponse> {
    this.assertConfigured();
    if (!file) throw new BadRequestException('El archivo no fue enviado');

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Formato no permitido. Solo se permiten jpg, jpeg, png y webp.');
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('El archivo supera los 5MB');
    }

    return new Promise((resolve, reject) => {
      try {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'boutique-elegance/products',
          },
          (error, result) => {
            if (error) return reject(this.toHttpError(error));
            resolve(result as UploadApiResponse);
          },
        );

        uploadStream.end(file.buffer);
      } catch (err) {
        reject(this.toHttpError(err));
      }
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    if (!this.configured) return;
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error(`Error deleting image ${publicId} from Cloudinary:`, err);
    }
  }

  getColorizedImageUrl(imagePublicId: string, sourceColor: string, targetHex: string): string {
    if (!imagePublicId) return '';
    if (!sourceColor || !targetHex) {
      return cloudinary.url(imagePublicId, { secure: true });
    }

    const target = targetHex.replace('#', '');
    const source = sourceColor.replace('#', '');

    return cloudinary.url(imagePublicId, {
      secure: true,
      effect: `replace_color:${target}:80:${source}`,
    });
  }
}

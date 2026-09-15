import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly config: ConfigService) {}

  /**
   * Upload da foto do alimento. Só doadores publicam, e o arquivo é gravado com
   * nome gerado (nunca o nome original, que viria do cliente) numa pasta servida
   * estaticamente. O tipo é validado pelo MIME declarado e pela extensão.
   */
  @Post('images')
  @Roles(UserRole.DONOR, UserRole.ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Envia uma imagem e devolve a URL pública para usar no item da doação.' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.UPLOADS_DIR ?? 'uploads',
        filename: (_req, file, callback) => {
          const extension = extname(file.originalname).toLowerCase().slice(0, 5);
          callback(null, `${randomUUID()}${extension}`);
        },
      }),
      limits: { fileSize: parseInt(process.env.UPLOADS_MAX_BYTES ?? '5242880', 10), files: 1 },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          callback(new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'Envie uma imagem JPG, PNG ou WEBP.' }), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Nenhum arquivo enviado.' });
    }
    return { url: `/uploads/${file.filename}`, sizeBytes: file.size };
  }
}

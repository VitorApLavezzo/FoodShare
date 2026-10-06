import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DecimalSerializerInterceptor } from './common/interceptors/decimal-serializer.interceptor';
import { RedisIoAdapter } from './modules/realtime/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // Fotos dos alimentos: servidas estaticamente a partir do volume de uploads.
  app.useStaticAssets(join(process.cwd(), config.get<string>('uploads.dir')!), { prefix: '/uploads/' });
  app.enableCors({ origin: config.get<string>('corsOrigin'), credentials: true });
  app.useWebSocketAdapter(new RedisIoAdapter(app, config.get<string>('redisUrl')!));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new DecimalSerializerInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FoodShare API')
    .setDescription('Plataforma distribuída de compartilhamento de alimentos excedentes')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');
  const logger = app.get(Logger);
  logger.log(`FoodShare API [node=${config.get('node.id')}] rodando em http://localhost:${port}`);
  logger.log(`Swagger docs em http://localhost:${port}/docs`);
}
void bootstrap();

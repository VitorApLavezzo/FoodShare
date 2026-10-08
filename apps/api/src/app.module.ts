import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { NodesModule } from './modules/nodes/nodes.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { DonationsModule } from './modules/donations/donations.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MapModule } from './modules/map/map.module';
import { AuditLogModule } from './modules/audit/audit-log.module';
import { SyncModule } from './modules/sync/sync.module';
import { ReportsModule } from './modules/reports/reports.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './modules/mail/mail.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CnpjModule } from './modules/cnpj/cnpj.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Log estruturado com o correlation ID em toda linha: o pacote já era
    // dependência do projeto mas nunca havia sido ligado — os logs saíam por
    // console.log, sem como correlacionar uma requisição entre os nós.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (req) => (req.headers['x-correlation-id'] as string) ?? randomUUID(),
        customProps: () => ({ nodeId: process.env.NODE_ID ?? 'LIMEIRA' }),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss' } },
        autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/ready' },
        // Não grava tokens nem cookies no log.
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    MailModule,
    HealthModule,
    NodesModule,
    UsersModule,
    AuthModule,
    OrganizationsModule,
    DonationsModule,
    ReservationsModule,
    DashboardModule,
    MapModule,
    AuditLogModule,
    SyncModule,
    ReportsModule,
    RealtimeModule,
    ChatModule,
    NotificationsModule,
    CnpjModule,
    UploadsModule,
    TemplatesModule,
    AdminModule,
  ],
  providers: [
    // Ordem importa: rate limit primeiro, depois autenticação, depois autorização por papel.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

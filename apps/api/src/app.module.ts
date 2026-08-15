import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
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

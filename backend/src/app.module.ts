import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { BranchesModule } from './modules/branches/branches.module';
import { ClientsModule } from './modules/clients/clients.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { SalesModule } from './modules/sales/sales.module';
import { IntelligenceModule } from './modules/intelligence/intelligence.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StoreModule } from './modules/store/store.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AuditModule } from './modules/audit/audit.module';
import { FirebaseModule } from './common/firebase/firebase.module';
import { WebsocketModule } from './common/realtime/websocket.module';
import { StockAlertSubscriber } from './modules/inventory/stock-alert.subscriber';
import { TenantSubscriber } from './common/tenancy/tenant.subscriber';
import { SyncModule } from './modules/sync/sync.module';
import { AiReportsModule } from './modules/ai-reports/ai-reports.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    FirebaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        // En la nube (Neon, Supabase, Render…) basta con DATABASE_URL; en local se usan DB_HOST, DB_PORT, etc.
        ...(configService.get<string>('DATABASE_URL')
          ? { url: configService.get<string>('DATABASE_URL') }
          : {
              host: configService.get<string>('DB_HOST'),
              port: configService.get<number>('DB_PORT'),
              username: configService.get<string>('DB_USERNAME'),
              password: configService.get<string>('DB_PASSWORD'),
              database: configService.get<string>('DB_DATABASE'),
            }),
        ssl: configService.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
        subscribers: [TenantSubscriber, StockAlertSubscriber],
        // SOLO DESARROLLO. En producción utilizar migrations (DB_SYNCHRONIZE=false).
        // Las FKs compuestas multitenant están declaradas en las entidades para que
        // synchronize NO las elimine.
        synchronize: configService.get<string>('DB_SYNCHRONIZE', 'true') !== 'false',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    CatalogModule,
    BranchesModule,
    ClientsModule,
    InventoryModule,
    ReservationsModule,
    SalesModule,
    IntelligenceModule,
    NotificationsModule,
    StoreModule,
    DashboardModule,
    ReportsModule,
    TenantsModule,
    WebsocketModule,
    SyncModule,
    AiReportsModule,
    AnalyticsModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

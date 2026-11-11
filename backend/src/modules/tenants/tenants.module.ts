import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';
import { Plan } from './plan.entity';
import { Subscription } from './subscription.entity';
import { SubscriptionHistory } from './subscription-history.entity';
import { TenantsService } from './tenants.service';
import { BillingService } from './billing.service';
import { TenantsController } from './tenants.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Plan, Subscription, SubscriptionHistory]),
    AuthModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService, BillingService],
  exports: [TenantsService, BillingService, TypeOrmModule],
})
export class TenantsModule {}


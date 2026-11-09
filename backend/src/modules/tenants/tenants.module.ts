import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';
import { Plan } from './plan.entity';
import { Subscription } from './subscription.entity';
import { SubscriptionHistory } from './subscription-history.entity';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { AuthModule } from '../auth/auth.module';
import { RegistrationVerification } from './registration-verification.entity';
import { CompanyRegistrationService } from './company-registration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Plan, Subscription, SubscriptionHistory, RegistrationVerification]),
    AuthModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService, CompanyRegistrationService],
  exports: [TenantsService, TypeOrmModule],
})
export class TenantsModule {}


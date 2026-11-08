import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AiReportLog } from './ai-report-log.entity';
import { AiReportsService } from './ai-reports.service';
import { AiReportsController } from './ai-reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AiReportLog]), AuthModule],
  controllers: [AiReportsController],
  providers: [AiReportsService],
})
export class AiReportsModule {}

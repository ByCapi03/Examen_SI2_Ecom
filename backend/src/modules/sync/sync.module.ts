import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SyncConflict, SyncOperation } from './sync.entities';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { ReservationsModule } from '../reservations/reservations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncOperation, SyncConflict]),
    AuthModule,
    CatalogModule,
    ReservationsModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}

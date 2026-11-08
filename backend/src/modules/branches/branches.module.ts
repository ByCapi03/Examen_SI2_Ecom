import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchesController } from './branches.controller';
import { CitiesController } from './cities.controller';
import { BranchesService } from './branches.service';
import { CitiesService } from './cities.service';

import { Branch } from './branch.entity';
import { City } from './city.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Branch, City]),
    AuthModule,
  ],
  controllers: [BranchesController, CitiesController],
  providers: [BranchesService, CitiesService],
})
export class BranchesModule {}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString,
  IsUUID, Matches, Min, ValidateNested,
} from 'class-validator';
import { SyncOperationType } from './sync.entities';

export class OfflineItemDto {
  @IsInt() @IsPositive() variantId: number;
  @IsInt() @IsPositive() quantity: number;
  /** Precio unitario que se cobró offline (solo ventas). */
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
}

export class OfflineOperationDto {
  @IsUUID() operationId: string;
  @IsEnum(SyncOperationType) type: SyncOperationType;
  @IsDateString() clientCreatedAt: string;
  @IsOptional() @IsInt() branchId?: number;
  @IsOptional() @IsInt() cashSessionId?: number;
  @IsOptional() @IsInt() clientId?: number;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @IsString() approximateTime?: string;
  @IsOptional() @IsIn(['web', 'mobile']) clientPlatform?: 'web' | 'mobile';
  @IsArray() @ValidateNested({ each: true }) @Type(() => OfflineItemDto) items: OfflineItemDto[];
}

export class SyncBatchDto {
  @IsOptional() @IsString() deviceId?: string;
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => OfflineOperationDto)
  operations: OfflineOperationDto[];
}

export class ResolveConflictDto {
  @IsIn(['ACEPTAR', 'AJUSTAR_INVENTARIO', 'ANULAR_VENTA', 'DESCARTAR'])
  action: 'ACEPTAR' | 'AJUSTAR_INVENTARIO' | 'ANULAR_VENTA' | 'DESCARTAR';
  @IsOptional() @IsString() notes?: string;
}

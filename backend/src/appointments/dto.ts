import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class AvailabilityQueryDto {
  @IsString() date!: string;
  @IsUUID() serviceId!: string;
  @IsOptional() @IsUUID() barberId?: string;
}

export class BookAppointmentDto {
  @IsUUID() serviceId!: string;
  @IsISO8601() startTime!: string;
  @IsOptional() @IsUUID() barberId?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

/** Encaixe registrado pelo barbeiro no balcão. */
export class WalkInAppointmentDto {
  @IsUUID() serviceId!: string;
  @IsISO8601() startTime!: string;
  @IsOptional() @IsUUID() barberId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsString() @MaxLength(120) clientName?: string;
  @IsOptional() @IsString() @MaxLength(40) clientPhone?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  /**
   * Encaixe fora da grade: ignora antecedência mínima e horizonte máximo.
   * A checagem de conflito com outro atendimento continua valendo.
   */
  @IsOptional() @IsBoolean() force?: boolean;
}

export class RescheduleAppointmentDto {
  @IsISO8601() startTime!: string;
  @IsOptional() @IsUUID() barberId?: string;
}

export class UpdateStatusDto {
  @IsEnum(AppointmentStatus) status!: AppointmentStatus;
}

export class ListAppointmentsQueryDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class AgendaQueryDto {
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsUUID() barberId?: string;
}

export class MetricsQueryDto {
  @IsString() startDate!: string;
  @IsString() endDate!: string;
  @IsOptional() @IsUUID() barberId?: string;
}

export class CreateReviewDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateShopSettingsDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;

  /** Fuso IANA, ex.: `America/Sao_Paulo`. Validado contra o ICU do runtime. */
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(120)
  slotIntervalMinutes?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(24 * 60)
  minAdvanceMinutes?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365)
  maxAdvanceDays?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(7 * 24 * 60)
  cancellationWindowMinutes?: number;

  @IsOptional() @IsString() @MaxLength(200) addressLine?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsUrl() @MaxLength(500) mapsUrl?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(40) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(80) instagram?: string;
  @IsOptional() @IsString() @MaxLength(1000) about?: string;
}

export class UpsertHolidayDto {
  @IsString() date!: string;
  @IsString() @MaxLength(120) description!: string;
}

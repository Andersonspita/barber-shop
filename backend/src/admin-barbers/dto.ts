import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  ValidateNested,
} from 'class-validator';

export class CreateBarberDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsEmail() email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s().-]{10,20}$/, {
    message: 'Informe um telefone válido com DDD.',
  })
  phoneNumber?: string;

  @IsOptional() @IsBoolean() isAdmin?: boolean;

  /** Fração, não porcentagem: 0.5 significa 50%. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1)
  commissionRate?: number;

  @IsOptional() @IsUrl() @MaxLength(500) photoUrl?: string;
  @IsOptional() @IsString() @MaxLength(400) bio?: string;
}

export class UpdateBarberDto extends CreateBarberDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class WorkingHoursItemDto {
  /** 0 = domingo … 6 = sábado */
  @Type(() => Number) @IsInt() @Min(0) @Max(6) weekday!: number;

  @Type(() => Number) @IsInt() @Min(0) @Max(24 * 60) startMinute!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(24 * 60) endMinute!: number;
}

export class ReplaceWorkingHoursDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursItemDto)
  shifts!: WorkingHoursItemDto[];
}

export class BarberServiceItemDto {
  @IsUUID() serviceId!: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  priceOverride?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(600)
  durationMinutesOverride?: number;
}

export class ReplaceBarberServicesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BarberServiceItemDto)
  services!: BarberServiceItemDto[];
}

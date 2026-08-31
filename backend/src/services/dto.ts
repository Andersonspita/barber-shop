import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpsertServiceDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;

  /** Substitui o texto genérico que a landing repetia em todo serviço. */
  @IsOptional() @IsString() @MaxLength(500) description?: string;

  @Type(() => Number) @IsInt() @Min(5) @Max(600) durationMinutes!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100000) price!: number;

  @IsOptional() @IsBoolean() isActive?: boolean;
}

import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;

  /** Opcional: quem chega pelo balcão nem sempre tem e-mail para dar. */
  @IsOptional() @IsEmail() email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s().-]{10,20}$/, {
    message: 'Informe um telefone válido com DDD.',
  })
  phoneNumber?: string;

  @IsOptional() @IsString() birthDate?: string;
}

export class UpdateClientDto extends CreateClientDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListClientsQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

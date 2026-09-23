import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateShopDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  /** Endereço público: /<slug>. Validado em `assertValidSlug`. */
  @IsString()
  @MaxLength(40)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  /** Primeiro administrador, que recebe uma senha temporária. */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  adminName!: string;

  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  adminEmail!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s().-]{10,20}$/, {
    message: 'Informe um telefone válido com DDD.',
  })
  adminPhone?: string;

  /** Plano inicial; padrão: Solo. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  planCode?: string;

  /** Dias de teste grátis; padrão: BILLING_TRIAL_DAYS. 0 = cobra desde já. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;
}

export class UpdateShopDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  slug?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Instância da Evolution API; string vazia volta para a padrão. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  whatsappInstance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  planCode?: string;

  /** Cortesia: sem fatura e sem limite de profissionais. */
  @IsOptional()
  @IsBoolean()
  billingExempt?: boolean;

  /** Fim do teste grátis (`AAAA-MM-DD`); string vazia encerra o teste. */
  @IsOptional()
  @IsString()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/, {
    message: 'Use a data no formato AAAA-MM-DD.',
  })
  trialEndsAt?: string;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  monthlyPrice?: number;

  /** Só nos planos sem limite de profissionais. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  extraBarberPrice?: number;
}

export class SetInvoiceStatusDto {
  @IsIn(['OPEN', 'PAID', 'CANCELED'])
  status!: 'OPEN' | 'PAID' | 'CANCELED';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

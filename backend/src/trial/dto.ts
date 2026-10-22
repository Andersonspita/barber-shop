import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const PLANS = ['SOLO', 'SQUAD', 'PRO', 'EMPIRE'] as const;
export type PlanCode = (typeof PLANS)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Pedido de teste grátis vindo do SDR-AI. */
export class CreateTrialDto {
  /** Id do lead no SDR. Torna o pedido idempotente. */
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  externalLeadId!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  shopName!: string;

  /** Endereço desejado. Se estiver em uso, ganha um sufixo (-2, -3...). */
  @IsString()
  @MaxLength(80)
  slug!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsIn(PLANS)
  plan?: PlanCode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  trialDays?: number;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  adminName!: string;

  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  adminEmail!: string;

  /** WhatsApp do dono: recebe o link de acesso e os avisos do teste. */
  @Matches(/^\+?[\d\s().-]{10,20}$/, {
    message: 'Informe um telefone válido com DDD.',
  })
  adminPhone!: string;
}

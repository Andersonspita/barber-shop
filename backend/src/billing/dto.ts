import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { BillingMethod, Plan } from '@prisma/client';

export const PLAN_CODES = ['SOLO', 'SQUAD', 'PRO', 'EMPIRE'] as const;
export const BILLING_METHODS = ['PIX', 'BOLETO', 'CREDIT_CARD'] as const;

export class SubscribeDto {
  @IsIn(PLAN_CODES)
  plan!: Plan;

  @IsIn(BILLING_METHODS, { message: 'Escolha Pix, boleto ou cartão.' })
  method!: BillingMethod;

  /** Do titular da cobrança. Vai para o Asaas e não fica guardado aqui. */
  @IsString()
  @MinLength(11)
  @MaxLength(18)
  cpfCnpj!: string;
}

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { createHash, timingSafeEqual } from 'node:crypto';
import { AdminOnly } from '../common/roles.guard';
import { ShopId } from '../common/shop-context';
import { BillingService } from './billing.service';
import type { AsaasWebhookEvent } from './billing.service';

class ChangePlanDto {
  @IsString() @MaxLength(40) planCode!: string;
}

export class OnlinePaymentDto {
  /** Do titular da cobrança. Vai para o Asaas e não fica guardado aqui. */
  @IsString() @MinLength(11) @MaxLength(18) cpfCnpj!: string;
}

/** Assinatura vista pelo admin da barbearia: plano, uso e faturas. */
@AdminOnly()
@Controller('admin/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  async summary(@ShopId() shopId: string) {
    return this.billing.summary(shopId);
  }

  /** Troca de plano pela própria barbearia. Vale a partir da próxima fatura. */
  @Put('plan')
  async changePlan(@ShopId() shopId: string, @Body() body: ChangePlanDto) {
    return this.billing.changePlan(shopId, body.planCode);
  }

  /** Liga o pagamento online: as faturas passam a sair com link de Pix/boleto/cartão. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('online-payment')
  async enableOnlinePayment(
    @ShopId() shopId: string,
    @Body() body: OnlinePaymentDto,
  ) {
    return this.billing.enableOnlinePayment(shopId, body.cpfCnpj);
  }
}

/**
 * Webhook do Asaas. O token configurado no webhook (`ASAAS_WEBHOOK_TOKEN`)
 * chega no cabeçalho `asaas-access-token`. Sem o token no .env, a rota nem
 * existe (404). Fora do limite global: o Asaas pode mandar rajadas.
 */
@Controller('billing/asaas')
export class AsaasWebhookController {
  constructor(private readonly billing: BillingService) {}

  @SkipThrottle()
  @HttpCode(200)
  @Post('webhook')
  async webhook(
    @Headers('asaas-access-token') token: string | undefined,
    @Body() body: AsaasWebhookEvent,
  ) {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
    if (!expected) throw new NotFoundException();
    if (!timingSafeEqual(digest(token ?? ''), digest(expected))) {
      throw new UnauthorizedException('Token do webhook inválido.');
    }
    return this.billing.handleAsaasWebhook(body);
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

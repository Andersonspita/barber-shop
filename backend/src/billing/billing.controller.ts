import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { createHash, timingSafeEqual } from 'node:crypto';
import { AdminOnly } from '../common/roles.guard';
import { ShopId } from '../common/shop-context';
import { BillingService } from './billing.service';
import type { AsaasWebhookEvent } from './billing.service';
import { SubscribeDto } from './dto';

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @AdminOnly()
  @Get('admin/billing')
  async status(@ShopId() shopId: string) {
    return this.billing.status(shopId);
  }

  /** O dono assina pelo painel e recebe o link da 1ª fatura. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @AdminOnly()
  @Post('admin/billing/subscribe')
  async subscribe(@ShopId() shopId: string, @Body() body: SubscribeDto) {
    return this.billing.subscribe(shopId, body);
  }

  /**
   * Webhook do Asaas. O token configurado no webhook (`ASAAS_WEBHOOK_TOKEN`)
   * chega no cabeçalho `asaas-access-token`. Sem o token no .env, a rota nem
   * existe (404). Fora do limite global: o Asaas pode mandar rajadas.
   */
  @SkipThrottle()
  @HttpCode(200)
  @Post('billing/asaas/webhook')
  async webhook(
    @Headers('asaas-access-token') token: string | undefined,
    @Body() body: AsaasWebhookEvent,
  ) {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
    if (!expected) throw new NotFoundException();
    if (!timingSafeEqual(digest(token ?? ''), digest(expected))) {
      throw new UnauthorizedException('Token do webhook inválido.');
    }
    return this.billing.handleWebhook(body);
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { AdminOnly } from '../common/roles.guard';
import { ShopId } from '../common/shop-context';
import { BillingService } from './billing.service';

class ChangePlanDto {
  @IsString() @MaxLength(40) planCode!: string;
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
}

import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ProvisioningGuard } from './provisioning.guard';
import { CreateTrialDto } from './dto';
import { TrialProvisioningService } from './trial-provisioning.service';

/**
 * Entrada do SDR-AI: cria a barbearia em teste grátis quando o lead topa.
 * 201 = criada agora; 200 = o lead já tinha barbearia (pedido repetido).
 */
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@UseGuards(ProvisioningGuard)
@Controller('provisioning')
export class ProvisioningController {
  constructor(private readonly trials: TrialProvisioningService) {}

  @Post('trials')
  async createTrial(
    @Body() body: CreateTrialDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.trials.provision(body);
    res.status(result.created ? 201 : 200);
    return result;
  }
}

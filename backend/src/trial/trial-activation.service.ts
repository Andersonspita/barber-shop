import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SdrWebhookService } from './sdr-webhook.service';

/**
 * Detecta o primeiro acesso do dono de uma barbearia em teste — é quando o
 * teste "começa de verdade" para o SDR-AI (lead em TRIAL_STARTED ativo).
 */
@Injectable()
export class TrialActivationService {
  private readonly logger = new Logger(TrialActivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: SdrWebhookService,
  ) {}

  /** Chamado depois de login e de definição de senha. Nunca lança erro. */
  async markActivated(userId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          isAdmin: true,
          shopId: true,
          shop: {
            select: { subscriptionStatus: true, trialActivatedAt: true },
          },
        },
      });
      // Caminho comum (cliente, barbeiro, barbearia fora de teste): só esta leitura.
      if (
        !user?.isAdmin ||
        user.shop.subscriptionStatus !== 'TRIAL' ||
        user.shop.trialActivatedAt
      ) {
        return;
      }

      // Condicional no próprio UPDATE: dois logins simultâneos não geram dois avisos.
      const { count } = await this.prisma.shop.updateMany({
        where: {
          id: user.shopId,
          subscriptionStatus: 'TRIAL',
          trialActivatedAt: null,
        },
        data: { trialActivatedAt: new Date() },
      });
      if (count === 0) return;

      const shop = await this.prisma.shop.findUniqueOrThrow({
        where: { id: user.shopId },
      });
      await this.webhooks.emit('trial.activated', shop);
    } catch (error) {
      this.logger.error(
        `Falha ao registrar o primeiro acesso do usuário ${userId}: ${String(error)}`,
      );
    }
  }
}

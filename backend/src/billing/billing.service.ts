import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BillingMethod, Plan, Prisma, Shop } from '@prisma/client';
import { subDays } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { ShopSettingsService } from '../shop/shop-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SdrWebhookService } from '../trial/sdr-webhook.service';
import { shopDateOnly } from '../common/time.util';
import { AsaasClient, AsaasError, AsaasPayment } from './asaas.client';
import { isValidCpfCnpj, onlyDigits } from './cpf-cnpj.util';
import { PLAN_NAMES, PLAN_PRICES, billingGraceDays } from './plans';

export interface SubscribeInput {
  plan: Plan;
  method: BillingMethod;
  cpfCnpj: string;
}

/** Evento de webhook do Asaas (só os campos usados aqui). */
export interface AsaasWebhookEvent {
  id?: string;
  event?: string;
  payment?: Partial<AsaasPayment> & { id?: string };
}

const PAID_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);

/**
 * Cobrança recorrente das barbearias pelo Asaas.
 *
 * - Assinar: cria cliente e assinatura mensal; o plano só vale quando a 1ª
 *   cobrança é paga (webhook), e até lá a barbearia segue no teste.
 * - Pagou: plano ativo e barbearia no ar (inclusive voltando de teste vencido
 *   ou suspensão).
 * - Venceu: PAST_DUE, segue no ar durante `BILLING_GRACE_DAYS`; depois disso,
 *   o job de cobrança suspende (SUSPENDED, fora do ar, sem apagar nada).
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shops: ShopSettingsService,
    private readonly asaas: AsaasClient,
    private readonly notifications: NotificationsService,
    private readonly webhooks: SdrWebhookService,
  ) {}

  get isEnabled(): boolean {
    return this.asaas.isConfigured;
  }

  /** Situação da cobrança para a tela de assinatura do dono. */
  async status(shopId: string) {
    const shop = await this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
    });
    return {
      enabled: this.isEnabled,
      subscriptionStatus: shop.subscriptionStatus,
      plan: shop.plan,
      pendingPlan: shop.pendingPlan,
      billingMethod: shop.billingMethod,
      trialEndsAt: shop.trialEndsAt,
      pastDueSince: shop.pastDueSince,
      suspendsAt: shop.pastDueSince
        ? addDaysIso(shop.pastDueSince, billingGraceDays())
        : null,
      invoiceUrl: shop.billingInvoiceUrl,
      hasSubscription: Boolean(shop.asaasSubscriptionId),
      plans: (Object.keys(PLAN_PRICES) as Plan[]).map((code) => ({
        code,
        name: PLAN_NAMES[code],
        price: PLAN_PRICES[code],
      })),
    };
  }

  /**
   * Cria a assinatura mensal e devolve o link da 1ª fatura. Refazer antes de
   * pagar (trocar plano ou forma de pagamento) cancela a assinatura anterior.
   */
  async subscribe(
    shopId: string,
    input: SubscribeInput,
    options: { notifyOwner?: boolean } = {},
  ) {
    if (!this.isEnabled) {
      throw new ServiceUnavailableException(
        'Cobrança online ainda não configurada. Fale com o suporte do Gerente Barber.',
      );
    }
    if (!isValidCpfCnpj(input.cpfCnpj)) {
      throw new BadRequestException('Informe um CPF ou CNPJ válido.');
    }

    const shop = await this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
    });
    if (
      shop.asaasSubscriptionId &&
      ['ACTIVE', 'PAST_DUE', 'SUSPENDED'].includes(shop.subscriptionStatus)
    ) {
      throw new ConflictException(
        shop.billingInvoiceUrl
          ? 'Já existe uma assinatura. Use o link da fatura em aberto para pagar.'
          : 'Esta barbearia já tem uma assinatura ativa.',
      );
    }
    const owner = await this.owner(shopId);

    try {
      const customerId =
        shop.asaasCustomerId ??
        (
          await this.asaas.createCustomer({
            name: shop.name,
            cpfCnpj: onlyDigits(input.cpfCnpj),
            email: owner?.email,
            mobilePhone: owner?.phoneNumber,
            externalReference: shop.id,
          })
        ).id;
      // Grava o cliente antes de seguir: se a assinatura falhar, o próximo pedido o reaproveita.
      if (!shop.asaasCustomerId) {
        await this.prisma.shop.update({
          where: { id: shopId },
          data: { asaasCustomerId: customerId },
        });
      }

      if (shop.asaasSubscriptionId) {
        await this.asaas.deleteSubscription(shop.asaasSubscriptionId);
      }

      const subscription = await this.asaas.createSubscription({
        customer: customerId,
        billingType: input.method,
        value: PLAN_PRICES[input.plan],
        nextDueDate: shopDateOnly(new Date(), shop.timezone),
        description: `Gerente Barber • Plano ${PLAN_NAMES[input.plan]} • ${shop.name}`,
        externalReference: shop.id,
      });
      const payment = await this.asaas.pendingPayment(subscription.id);

      await this.prisma.shop.update({
        where: { id: shopId },
        data: {
          asaasSubscriptionId: subscription.id,
          pendingPlan: input.plan,
          billingMethod: input.method,
          billingInvoiceUrl: payment?.invoiceUrl ?? null,
        },
      });

      if (options.notifyOwner && payment?.invoiceUrl) {
        await this.notifyOwner(
          shopId,
          `Sua assinatura do Gerente Barber (Plano ${PLAN_NAMES[input.plan]}, ${formatPrice(PLAN_PRICES[input.plan])}/mês) está pronta.\n\n` +
            `Pague a primeira mensalidade por este link e o plano é ativado na hora:\n${payment.invoiceUrl}`,
        );
      }

      this.logger.log(`Assinatura ${input.plan} criada para ${shop.slug}`);
      return {
        plan: input.plan,
        price: PLAN_PRICES[input.plan],
        method: input.method,
        invoiceUrl: payment?.invoiceUrl ?? null,
      };
    } catch (error) {
      if (error instanceof AsaasError) {
        throw new BadRequestException(`Asaas: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Webhook do Asaas. Grava o id do evento antes de processar: um reenvio do
   * mesmo evento é ignorado. Se o processamento falhar, o registro é desfeito
   * e o erro devolve 500 — o Asaas tenta de novo.
   */
  async handleWebhook(body: AsaasWebhookEvent) {
    if (!body.id || !body.event) {
      throw new BadRequestException('Evento sem id ou tipo.');
    }

    try {
      await this.prisma.billingEvent.create({
        data: {
          id: body.id,
          event: body.event,
          paymentId: body.payment?.id ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { status: 'duplicate' };
      }
      throw error;
    }

    try {
      return await this.process(body.event, body.payment);
    } catch (error) {
      await this.prisma.billingEvent
        .delete({ where: { id: body.id } })
        .catch(() => undefined);
      throw error;
    }
  }

  private async process(event: string, payment: AsaasWebhookEvent['payment']) {
    const subscriptionId = payment?.subscription;
    if (!subscriptionId)
      return { status: 'ignored', reason: 'cobrança avulsa' };

    // Só a assinatura atual conta: pagamento de uma assinatura já trocada é ignorado.
    const shop = await this.prisma.shop.findUnique({
      where: { asaasSubscriptionId: subscriptionId },
    });
    if (!shop) return { status: 'ignored', reason: 'assinatura desconhecida' };

    if (PAID_EVENTS.has(event)) return this.activate(shop);
    if (event === 'PAYMENT_OVERDUE') return this.markPastDue(shop, payment);
    if (event === 'PAYMENT_CREATED' && payment?.invoiceUrl) {
      await this.prisma.shop.update({
        where: { id: shop.id },
        data: { billingInvoiceUrl: payment.invoiceUrl },
      });
      return { status: 'processed' };
    }
    return { status: 'ignored', reason: `evento ${event} sem efeito` };
  }

  private async activate(shop: Shop) {
    const previous = shop.subscriptionStatus;
    const plan = shop.pendingPlan ?? shop.plan ?? 'SOLO';
    const updated = await this.prisma.shop.update({
      where: { id: shop.id },
      data: {
        subscriptionStatus: 'ACTIVE',
        isActive: true,
        plan,
        pendingPlan: null,
        pastDueSince: null,
        billingInvoiceUrl: null,
      },
    });
    // Volta ao ar na hora, não quando o cache de 30 s vencer.
    this.shops.forget(shop.id);

    if (previous === 'TRIAL' || previous === 'EXPIRED') {
      await this.webhooks.emit('subscription.activated', updated);
      await this.notifyOwner(
        shop.id,
        `Pagamento confirmado! O Plano ${PLAN_NAMES[plan]} da ${shop.name} está ativo. Bom trabalho por aí! ✂️`,
      );
    } else if (previous === 'PAST_DUE' || previous === 'SUSPENDED') {
      await this.webhooks.emit('subscription.reactivated', updated);
      await this.notifyOwner(
        shop.id,
        `Pagamento recebido, obrigado! A ${shop.name} está em dia${previous === 'SUSPENDED' ? ' e de volta ao ar' : ''}.`,
      );
    }
    return { status: 'processed', subscriptionStatus: 'ACTIVE' };
  }

  private async markPastDue(shop: Shop, payment: AsaasWebhookEvent['payment']) {
    // No teste, a 1ª fatura vencida não muda nada: quem decide é o fim do teste.
    if (shop.subscriptionStatus !== 'ACTIVE') {
      return {
        status: 'ignored',
        reason: `barbearia em ${shop.subscriptionStatus}`,
      };
    }

    const now = new Date();
    const invoiceUrl = payment?.invoiceUrl ?? shop.billingInvoiceUrl;
    const updated = await this.prisma.shop.update({
      where: { id: shop.id },
      data: {
        subscriptionStatus: 'PAST_DUE',
        pastDueSince: shop.pastDueSince ?? now,
        billingInvoiceUrl: invoiceUrl,
      },
    });
    await this.notifyOwner(
      shop.id,
      `A mensalidade do Gerente Barber da ${shop.name} venceu.\n\n` +
        (invoiceUrl ? `Pague por aqui: ${invoiceUrl}\n\n` : '') +
        `Sem o pagamento em ${billingGraceDays()} dias, a página sai do ar (nenhum dado é apagado).`,
    );
    await this.webhooks.emit('subscription.past_due', updated);
    return { status: 'processed', subscriptionStatus: 'PAST_DUE' };
  }

  /** Suspende quem passou da tolerância. Chamado pelo job de cobrança. */
  async suspendOverdue(now: Date): Promise<number> {
    const limit = subDays(now, billingGraceDays());
    const shops = await this.prisma.shop.findMany({
      where: { subscriptionStatus: 'PAST_DUE', pastDueSince: { lte: limit } },
      select: { id: true },
    });

    let suspended = 0;
    for (const { id } of shops) {
      try {
        const { count } = await this.prisma.shop.updateMany({
          where: { id, subscriptionStatus: 'PAST_DUE' },
          data: { subscriptionStatus: 'SUSPENDED', isActive: false },
        });
        if (count === 0) continue;
        this.shops.forget(id);

        const shop = await this.prisma.shop.findUniqueOrThrow({
          where: { id },
        });
        await this.notifyOwner(
          id,
          `A página da ${shop.name} saiu do ar por falta de pagamento.\n\n` +
            (shop.billingInvoiceUrl
              ? `Assim que a fatura for paga ela volta sozinha: ${shop.billingInvoiceUrl}`
              : 'Fale com a gente para regularizar e voltar ao ar.'),
        );
        await this.webhooks.emit('subscription.suspended', shop);
        suspended++;
        this.logger.log(`Barbearia suspensa por inadimplência: ${shop.slug}`);
      } catch (error) {
        this.logger.error(
          `Suspensão da barbearia ${id} falhou: ${String(error)}`,
        );
      }
    }
    return suspended;
  }

  private owner(shopId: string) {
    return this.prisma.user.findFirst({
      where: { shopId, isAdmin: true, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { email: true, phoneNumber: true },
    });
  }

  private async notifyOwner(shopId: string, message: string) {
    const owner = await this.owner(shopId);
    await this.notifications.billingNotice(
      shopId,
      owner?.phoneNumber ?? '',
      message,
    );
  }
}

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function addDaysIso(date: Date, days: number): string {
  return new Date(date.getTime() + days * 86_400_000).toISOString();
}

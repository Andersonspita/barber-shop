import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Invoice, InvoiceStatus, Plan, Prisma, Shop } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShopSettingsService } from '../shop/shop-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  SdrWebhookService,
  TrialEvent,
  notifiesThroughSdr,
} from '../trial/sdr-webhook.service';
import {
  dateOnlyToUtcMidnight,
  shopDateOnly,
  shopToday,
} from '../common/time.util';
import {
  BillingStatus,
  addDaysISO,
  billingStatus,
  canAddBarber,
  centsToDecimalString,
  invoiceAmountCents,
  nextInvoicePeriod,
  planFits,
} from './billing.rules';
import { AsaasClient, AsaasError } from './asaas.client';
import { isValidCpfCnpj, onlyDigits } from './cpf-cnpj.util';

const PLATFORM_NAME = 'Gerente Barber';

/**
 * Eventos do Asaas que significam "a fatura foi paga". Cartão e boleto mandam
 * CONFIRMED e, quando o dinheiro cai, RECEIVED; Pix manda só RECEIVED. O
 * segundo evento da mesma cobrança encontra a fatura já paga e é ignorado.
 */
const ASAAS_PAID_EVENTS = new Set([
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_RECEIVED_IN_CASH',
]);

/** O pagamento foi desfeito (estorno, chargeback): a fatura volta a ficar aberta. */
const ASAAS_REVERSED_EVENTS: Record<string, string> = {
  PAYMENT_REFUNDED: 'Pagamento estornado no Asaas',
  PAYMENT_CHARGEBACK_REQUESTED: 'Chargeback aberto no cartão',
  PAYMENT_RECEIVED_IN_CASH_UNDONE: 'Recebimento em dinheiro desfeito no Asaas',
};

/** Configuração da cobrança, lida do ambiente com padrões seguros. */
export const BILLING_CONFIG = {
  get trialDays() {
    return intEnv('BILLING_TRIAL_DAYS', 14);
  },
  get graceDays() {
    return intEnv('BILLING_GRACE_DAYS', 7);
  },
  get invoiceDaysBefore() {
    return intEnv('BILLING_INVOICE_DAYS_BEFORE', 5);
  },
  get paymentInstructions() {
    return process.env.BILLING_PAYMENT_INSTRUCTIONS?.trim() ?? '';
  },
};

function intEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

type ShopWithPlan = Shop & { plan: Plan | null };

/** Evento de webhook do Asaas (só os campos usados aqui). */
export interface AsaasWebhookEvent {
  id?: string;
  event?: string;
  payment?: { id?: string; externalReference?: string | null };
}

/**
 * Mensalidade das barbearias.
 *
 * A fatura é gerada aqui e é o registro único da cobrança. Ela pode ser paga
 * de dois jeitos: online, pela cobrança que o Asaas emite para ela (a baixa
 * vem sozinha pelo webhook), ou por fora (Pix, transferência), com baixa
 * manual de quem opera a plataforma. O atraso além da tolerância pausa só o
 * agendamento online — a agenda já marcada, o painel e o encaixe de balcão
 * continuam funcionando, para ninguém ficar sem atender e o admin conseguir
 * regularizar.
 *
 * Barbearias vindas do SDR-AI recebem os avisos na conversa do SDR (que trata
 * a resposta); as demais, pelo WhatsApp da plataforma.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shops: ShopSettingsService,
    private readonly notifications: NotificationsService,
    private readonly asaas: AsaasClient,
    private readonly webhooks: SdrWebhookService,
  ) {}

  // ---------------------------------------------------------------- leitura

  async plans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async activeBarbers(shopId: string): Promise<number> {
    return this.prisma.user.count({
      where: { shopId, role: 'BARBER', isActive: true },
    });
  }

  async status(shopId: string, now = new Date()): Promise<BillingStatus> {
    const shop = await this.loadShop(shopId);
    const oldestOpen = await this.oldestOpenInvoice(shopId);
    return this.computeStatus(shop, oldestOpen, now);
  }

  /** Resumo da assinatura para o painel do admin e para a plataforma. */
  async summary(shopId: string, now = new Date()) {
    const shop = await this.loadShop(shopId);
    const [oldestOpen, invoices, activeBarbers, plans] = await Promise.all([
      this.oldestOpenInvoice(shopId),
      this.prisma.invoice.findMany({
        where: { shopId },
        orderBy: { periodStart: 'desc' },
        take: 24,
      }),
      this.activeBarbers(shopId),
      this.plans(),
    ]);

    const status = this.computeStatus(shop, oldestOpen, now);
    const nextAmountCents = shop.plan
      ? invoiceAmountCents(shop.plan, activeBarbers)
      : null;

    return {
      status,
      exempt: shop.billingExempt,
      plan: shop.plan ? this.planView(shop.plan) : null,
      activeBarbers,
      nextAmount:
        nextAmountCents === null ? null : centsToDecimalString(nextAmountCents),
      trialEndsAt: shop.trialEndsAt ? isoDate(shop.trialEndsAt) : null,
      openInvoice: oldestOpen ? this.invoiceView(oldestOpen) : null,
      invoices: invoices.map((invoice) => this.invoiceView(invoice)),
      plans: plans.map((plan) => ({
        ...this.planView(plan),
        fits: planFits(plan, activeBarbers),
      })),
      graceDays: BILLING_CONFIG.graceDays,
      paymentInstructions: BILLING_CONFIG.paymentInstructions,
      onlinePayment: {
        /** A plataforma tem o Asaas configurado. */
        available: this.asaas.isConfigured,
        /** Esta barbearia já informou CPF/CNPJ: as faturas saem com link. */
        enabled: Boolean(shop.asaasCustomerId),
      },
    };
  }

  /** Resumo curto, para a lista de barbearias da plataforma. */
  async brief(shopId: string, now = new Date()) {
    const shop = await this.loadShop(shopId);
    const [oldestOpen, activeBarbers] = await Promise.all([
      this.oldestOpenInvoice(shopId),
      this.activeBarbers(shopId),
    ]);
    return {
      status: this.computeStatus(shop, oldestOpen, now),
      exempt: shop.billingExempt,
      plan: shop.plan ? this.planView(shop.plan) : null,
      trialEndsAt: shop.trialEndsAt ? isoDate(shop.trialEndsAt) : null,
      nextAmount: shop.plan
        ? centsToDecimalString(invoiceAmountCents(shop.plan, activeBarbers))
        : null,
      openInvoice: oldestOpen ? this.invoiceView(oldestOpen) : null,
      onlinePayment: Boolean(shop.asaasCustomerId),
    };
  }

  /** Fim do teste grátis para uma barbearia criada hoje. */
  trialEndFor(
    timezone: string,
    trialDays: number,
    now = new Date(),
  ): Date | null {
    if (trialDays <= 0) return null;
    return dateOnlyToUtcMidnight(
      addDaysISO(shopToday(timezone, now), trialDays),
    );
  }

  async updatePlanPrices(
    code: string,
    data: { name?: string; monthlyPrice?: number; extraBarberPrice?: number },
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { code } });
    if (!plan) throw new NotFoundException('Plano não encontrado.');
    if (data.extraBarberPrice !== undefined && plan.maxBarbers !== null) {
      throw new BadRequestException(
        'Valor por profissional extra só existe em plano sem limite de profissionais.',
      );
    }
    const updated = await this.prisma.plan.update({
      where: { code },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.monthlyPrice !== undefined
          ? { monthlyPrice: data.monthlyPrice.toFixed(2) }
          : {}),
        ...(data.extraBarberPrice !== undefined
          ? { extraBarberPrice: data.extraBarberPrice.toFixed(2) }
          : {}),
      },
    });
    return this.planView(updated);
  }

  async planViews() {
    return (await this.plans()).map((plan) => this.planView(plan));
  }

  /** O agendamento online está pausado por falta de pagamento? */
  async onlineBookingBlocked(shopId: string): Promise<boolean> {
    return (await this.status(shopId)) === 'BLOCKED';
  }

  async assertOnlineBookingOpen(shopId: string) {
    if (await this.onlineBookingBlocked(shopId)) {
      throw new ForbiddenException(
        'O agendamento online desta barbearia está pausado no momento. Fale com a barbearia pelo WhatsApp ou telefone.',
      );
    }
  }

  // ---------------------------------------------------------- limite e plano

  /**
   * Cabe mais um profissional ativo? Chamado ao cadastrar ou reativar alguém.
   * A mensagem já diz qual plano resolve.
   */
  async assertCanAddBarber(shopId: string) {
    const shop = await this.loadShop(shopId);
    const active = await this.activeBarbers(shopId);
    if (canAddBarber(shop.plan, shop.billingExempt, active)) return;

    const plans = await this.plans();
    const next = plans.find((plan) => planFits(plan, active + 1));
    throw new BadRequestException(
      `O plano ${shop.plan?.name} permite ${shop.plan?.maxBarbers} profissional(is) ativo(s).` +
        (next
          ? ` Mude para o plano ${next.name} em Assinatura para cadastrar mais.`
          : ''),
    );
  }

  /** Troca de plano. Vale para a próxima fatura; a aberta não muda. */
  async changePlan(shopId: string, planCode: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { code: planCode, isActive: true },
    });
    if (!plan) throw new NotFoundException('Plano não encontrado.');

    const active = await this.activeBarbers(shopId);
    if (!planFits(plan, active)) {
      throw new BadRequestException(
        `O plano ${plan.name} comporta ${plan.maxBarbers} profissional(is), e a barbearia tem ${active} ativo(s). Desative quem não atende mais antes de trocar.`,
      );
    }

    await this.prisma.shop.update({
      where: { id: shopId },
      data: { planCode: plan.code },
    });
    this.shops.forget(shopId);
    return this.summary(shopId);
  }

  // ------------------------------------------------------ pagamento online

  /**
   * Liga o pagamento online (Asaas) da barbearia: cria o cliente com o CPF/CNPJ
   * de quem paga e emite a cobrança das faturas em aberto. O CPF/CNPJ vai só
   * para o Asaas; aqui fica apenas o id do cliente. Com `notify`, o link da
   * fatura em aberto é enviado ao dono (pela conversa do SDR, se ele veio de lá).
   */
  async enableOnlinePayment(
    shopId: string,
    cpfCnpj: string,
    options: { notify?: boolean } = {},
  ) {
    if (!this.asaas.isConfigured) {
      throw new ServiceUnavailableException(
        'Pagamento online ainda não configurado. Fale com o suporte do Gerente Barber.',
      );
    }
    if (!isValidCpfCnpj(cpfCnpj)) {
      throw new BadRequestException('Informe um CPF ou CNPJ válido.');
    }

    let shop = await this.loadShop(shopId);
    if (!shop.asaasCustomerId) {
      const owner = await this.prisma.user.findFirst({
        where: { shopId, isAdmin: true, isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { email: true, phoneNumber: true },
      });
      try {
        const customer = await this.asaas.createCustomer({
          name: shop.name,
          cpfCnpj: onlyDigits(cpfCnpj),
          email: owner?.email,
          mobilePhone: owner?.phoneNumber,
          externalReference: shop.id,
        });
        await this.prisma.shop.update({
          where: { id: shopId },
          data: { asaasCustomerId: customer.id },
        });
      } catch (error) {
        if (error instanceof AsaasError) {
          throw new BadRequestException(`Asaas: ${error.message}`);
        }
        throw error;
      }
      shop = await this.loadShop(shopId);
    }

    const open = await this.prisma.invoice.findMany({
      where: { shopId, status: 'OPEN', asaasPaymentId: null },
      orderBy: { dueDate: 'asc' },
    });
    for (const invoice of open) {
      await this.chargeOnline(shop, invoice);
    }

    const oldest = await this.oldestOpenInvoice(shopId);
    if (options.notify && oldest?.invoiceUrl) {
      await this.notifyOwner(
        shop,
        'subscription.invoice_created',
        `Sua mensalidade do ${PLATFORM_NAME} (${formatBRL(oldest.amount)}) já pode ser paga online:\n${oldest.invoiceUrl}`,
      );
    }
    return this.summary(shopId);
  }

  /**
   * Webhook do Asaas. Grava o id do evento antes de processar: um reenvio do
   * mesmo evento é ignorado. Se o processamento falhar, o registro é desfeito
   * e o erro devolve 500 — o Asaas tenta de novo.
   */
  async handleAsaasWebhook(body: AsaasWebhookEvent) {
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
      const event = body.event;
      const reversed = ASAAS_REVERSED_EVENTS[event];
      if (
        !ASAAS_PAID_EVENTS.has(event) &&
        !reversed &&
        event !== 'PAYMENT_DELETED'
      ) {
        // Vencimento e pausa saem da própria fatura (rotina de cobrança).
        return { status: 'ignored', reason: `evento ${event} sem efeito` };
      }
      const invoice = await this.findInvoiceForPayment(body.payment);
      if (!invoice) return { status: 'ignored', reason: 'fatura desconhecida' };

      if (event === 'PAYMENT_DELETED') {
        // Apagada no painel do Asaas: a fatura segue aberta, sem o link morto.
        if (invoice.status !== 'OPEN') {
          return { status: 'ignored', reason: `fatura já ${invoice.status}` };
        }
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { asaasPaymentId: null, invoiceUrl: null },
        });
        return { status: 'processed' };
      }

      if (reversed) {
        if (invoice.status !== 'PAID') {
          return { status: 'ignored', reason: `fatura ${invoice.status}` };
        }
        this.logger.warn(`${reversed}: fatura ${invoice.id} reaberta.`);
        await this.setInvoiceStatus(invoice.id, 'OPEN', reversed, {
          source: 'asaas',
        });
        return { status: 'processed' };
      }

      if (invoice.status !== 'OPEN') {
        return { status: 'ignored', reason: `fatura já ${invoice.status}` };
      }
      await this.setInvoiceStatus(invoice.id, 'PAID', 'Pago online (Asaas)', {
        source: 'asaas',
      });
      return { status: 'processed' };
    } catch (error) {
      await this.prisma.billingEvent
        .delete({ where: { id: body.id } })
        .catch(() => undefined);
      throw error;
    }
  }

  // ------------------------------------------------------------------ faturas

  /**
   * Gera a próxima fatura da barbearia, se já for hora (ou agora mesmo, com
   * `force`). Idempotente: a mesma competência nunca sai duas vezes.
   */
  async generateNextInvoice(
    shopId: string,
    options: { now?: Date; force?: boolean; notify?: boolean } = {},
  ): Promise<Invoice | null> {
    const now = options.now ?? new Date();
    const shop = await this.loadShop(shopId);
    if (shop.billingExempt || !shop.isActive) return null;
    if (!shop.plan) {
      this.logger.warn(
        `Barbearia ${shop.slug} sem plano: nenhuma fatura gerada.`,
      );
      return null;
    }

    // Fatura cancelada conta como competência resolvida ("não cobrar este
    // mês"): a próxima começa depois dela.
    const last = await this.prisma.invoice.findFirst({
      where: { shopId },
      orderBy: { periodStart: 'desc' },
    });

    const period = nextInvoicePeriod({
      today: shopToday(shop.timezone, now),
      firstPeriodStart: shop.trialEndsAt
        ? isoDate(shop.trialEndsAt)
        : shopDateOnly(shop.createdAt, shop.timezone),
      lastPeriodEnd: last ? isoDate(last.periodEnd) : null,
      daysBefore: BILLING_CONFIG.invoiceDaysBefore,
      force: options.force,
    });
    if (!period) return null;

    const barbers = await this.activeBarbers(shopId);
    const amount = centsToDecimalString(invoiceAmountCents(shop.plan, barbers));

    let invoice: Invoice;
    try {
      invoice = await this.prisma.invoice.create({
        data: {
          shopId,
          periodStart: dateOnlyToUtcMidnight(period.periodStart),
          periodEnd: dateOnlyToUtcMidnight(period.periodEnd),
          dueDate: dateOnlyToUtcMidnight(period.periodStart),
          planCode: shop.plan.code,
          planName: shop.plan.name,
          barbers,
          amount,
        },
      });
    } catch (error) {
      // Corrida com outro processo gerando a mesma competência.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }

    invoice = await this.chargeOnline(shop, invoice, now);

    if (options.notify !== false) {
      await this.notifyOwner(
        shop,
        'subscription.invoice_created',
        `Olá! A mensalidade do ${PLATFORM_NAME} para a ${shop.name} está disponível.\n\n` +
          `📋 Plano ${invoice.planName} · ${barbers} profissional(is)\n` +
          `💰 ${formatBRL(amount)}\n` +
          `🗓️ Vencimento: ${formatDate(invoice.dueDate)}\n` +
          this.payLine(invoice),
        now,
      );
    }
    return invoice;
  }

  async listInvoices(shopId: string) {
    await this.loadShop(shopId);
    const invoices = await this.prisma.invoice.findMany({
      where: { shopId },
      orderBy: { periodStart: 'desc' },
    });
    return invoices.map((invoice) => this.invoiceView(invoice));
  }

  /**
   * Baixa da fatura: pagamento recebido (por fora ou pelo Asaas) ou
   * cancelamento. Na baixa manual, a cobrança aberta no Asaas é cancelada para
   * ninguém pagar duas vezes. Quando a baixa tira a barbearia do atraso ou é o
   * primeiro pagamento, o dono (ou o SDR) é avisado.
   */
  async setInvoiceStatus(
    invoiceId: string,
    status: InvoiceStatus,
    note?: string,
    options: { source?: 'manual' | 'asaas' } = {},
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada.');
    const before = await this.status(invoice.shopId);

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        paidAt: status === 'PAID' ? new Date() : null,
        ...(note !== undefined ? { note: note.trim() || null } : {}),
      },
    });

    if (
      options.source !== 'asaas' &&
      status !== 'OPEN' &&
      invoice.asaasPaymentId
    ) {
      await this.asaas
        .deletePayment(invoice.asaasPaymentId)
        .catch((error) =>
          this.logger.warn(
            `Cobrança ${invoice.asaasPaymentId} não foi cancelada no Asaas: ${String(error)}`,
          ),
        );
    }

    if (status === 'PAID' && invoice.status !== 'PAID') {
      await this.afterPayment(invoice.shopId, before);
    }
    return this.invoiceView(updated);
  }

  // ------------------------------------------------------------ rotina diária

  /**
   * Roda de hora em hora: gera as faturas que chegaram na antecedência e
   * avisa quem venceu e quem entrou no bloqueio. Cada aviso é marcado na
   * fatura, então rodar de novo não repete mensagem.
   */
  async runDaily(now = new Date()) {
    const shops = await this.prisma.shop.findMany({
      where: { isActive: true, billingExempt: false },
      select: { id: true },
    });

    let created = 0;
    for (const { id } of shops) {
      try {
        if (await this.generateNextInvoice(id, { now })) created++;
        await this.notifyLateness(id, now);
      } catch (error) {
        this.logger.error(
          `Cobrança da barbearia ${id} falhou: ${String(error)}`,
        );
      }
    }
    if (created > 0) this.logger.log(`${created} fatura(s) gerada(s).`);
  }

  private async notifyLateness(shopId: string, now: Date) {
    const shop = await this.loadShop(shopId);
    const oldest = await this.oldestOpenInvoice(shopId);
    if (!oldest) return;

    const status = this.computeStatus(shop, oldest, now);
    const due = formatDate(oldest.dueDate);

    if (status === 'BLOCKED' && !oldest.blockedNotifiedAt) {
      await this.notifyOwner(
        shop,
        'subscription.suspended',
        `O agendamento online da ${shop.name} foi pausado: a mensalidade de ${formatBRL(oldest.amount)}, vencida em ${due}, continua em aberto.\n\n` +
          `A agenda já marcada e o painel continuam funcionando. Assim que o pagamento for confirmado, o agendamento volta na hora.\n` +
          this.payLine(oldest),
        now,
      );
      await this.prisma.invoice.update({
        where: { id: oldest.id },
        data: {
          blockedNotifiedAt: now,
          overdueNotifiedAt: oldest.overdueNotifiedAt ?? now,
        },
      });
    } else if (status === 'PAST_DUE' && !oldest.overdueNotifiedAt) {
      const pauseOn = formatDate(this.pausesAt(oldest));
      // A 1ª fatura de uma barbearia em teste vence no fim do teste.
      const firstAfterTrial =
        Boolean(shop.trialEndsAt) &&
        (await this.prisma.invoice.count({ where: { shopId } })) === 1;
      await this.notifyOwner(
        shop,
        firstAfterTrial ? 'trial.expired' : 'subscription.past_due',
        `A mensalidade da ${shop.name} (${formatBRL(oldest.amount)}) venceu em ${due}.\n\n` +
          `Se não for paga, o agendamento online será pausado em ${pauseOn}.\n` +
          this.payLine(oldest),
        now,
      );
      await this.prisma.invoice.update({
        where: { id: oldest.id },
        data: { overdueNotifiedAt: now },
      });
    }
  }

  // ---------------------------------------------------------------- internos

  /**
   * Emite a cobrança da fatura no Asaas, se a barbearia ativou o pagamento
   * online. Falha no Asaas não impede a fatura: ela continua pagável por fora.
   */
  private async chargeOnline(
    shop: Shop,
    invoice: Invoice,
    now = new Date(),
  ): Promise<Invoice> {
    if (
      !this.asaas.isConfigured ||
      !shop.asaasCustomerId ||
      invoice.asaasPaymentId ||
      invoice.status !== 'OPEN'
    ) {
      return invoice;
    }
    // O Asaas não aceita vencimento no passado: fatura já vencida vence hoje.
    const today = shopToday(shop.timezone, now);
    const due = isoDate(invoice.dueDate);
    try {
      const payment = await this.asaas.createPayment({
        customer: shop.asaasCustomerId,
        billingType: 'UNDEFINED',
        value: Number(invoice.amount.toString()),
        dueDate: due < today ? today : due,
        description: `${PLATFORM_NAME} • ${invoice.planName} • ${shop.name} • ${formatDate(invoice.periodStart)} a ${formatDate(invoice.periodEnd)}`,
        externalReference: invoice.id,
      });
      return await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          asaasPaymentId: payment.id,
          invoiceUrl: payment.invoiceUrl ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Cobrança online da fatura ${invoice.id} (${shop.slug}) falhou: ${String(error)}`,
      );
      return invoice;
    }
  }

  private async findInvoiceForPayment(
    payment: AsaasWebhookEvent['payment'],
  ): Promise<Invoice | null> {
    if (payment?.id) {
      const byPayment = await this.prisma.invoice.findUnique({
        where: { asaasPaymentId: payment.id },
      });
      if (byPayment) return byPayment;
    }
    if (payment?.externalReference) {
      return this.prisma.invoice.findUnique({
        where: { id: payment.externalReference },
      });
    }
    return null;
  }

  /** Primeiro pagamento (virou cliente) ou saída do atraso: avisa. */
  private async afterPayment(shopId: string, before: BillingStatus) {
    const shop = await this.loadShop(shopId);
    const paid = await this.prisma.invoice.count({
      where: { shopId, status: 'PAID' },
    });

    if (paid === 1) {
      await this.notifyOwner(
        shop,
        'subscription.activated',
        `Pagamento confirmado! A assinatura do ${PLATFORM_NAME} da ${shop.name} está ativa. Bom trabalho por aí! ✂️`,
      );
    } else if (before === 'PAST_DUE' || before === 'BLOCKED') {
      const after = await this.status(shopId);
      if (after !== 'PAST_DUE' && after !== 'BLOCKED') {
        await this.notifyOwner(
          shop,
          'subscription.reactivated',
          `Pagamento recebido, obrigado! A ${shop.name} está em dia` +
            (before === 'BLOCKED' ? ' e o agendamento online já voltou.' : '.'),
        );
      }
    }
  }

  /**
   * Aviso ao dono. Barbearia vinda do SDR: vai pela conversa do SDR (que trata
   * a resposta). Demais: pelo WhatsApp da plataforma.
   */
  private async notifyOwner(
    shop: Shop,
    event: TrialEvent,
    message: string,
    now = new Date(),
  ) {
    if (notifiesThroughSdr(shop)) {
      await this.emitToSdr(event, shop.id, now);
      return;
    }
    await this.notifyAdmins(shop, message);
  }

  /** Situação atual da barbearia, enviada ao SDR junto com o evento. */
  async emitToSdr(event: TrialEvent, shopId: string, now = new Date()) {
    const shop = await this.loadShop(shopId);
    const oldest = await this.oldestOpenInvoice(shopId);
    await this.webhooks.emit(event, {
      id: shop.id,
      slug: shop.slug,
      name: shop.name,
      externalLeadId: shop.externalLeadId,
      planCode: shop.planCode,
      trialEndsAt: shop.trialEndsAt,
      status: this.computeStatus(shop, oldest, now),
      invoiceUrl: oldest?.invoiceUrl ?? null,
      pausesAt: oldest ? this.pausesAt(oldest) : null,
    });
  }

  /** Dia em que o agendamento online pausa se a fatura não for paga. */
  private pausesAt(invoice: Invoice): Date {
    return dateOnlyToUtcMidnight(
      addDaysISO(isoDate(invoice.dueDate), BILLING_CONFIG.graceDays + 1),
    );
  }

  private computeStatus(
    shop: ShopWithPlan,
    oldestOpen: Invoice | null,
    now: Date,
  ): BillingStatus {
    return billingStatus({
      exempt: shop.billingExempt,
      today: shopToday(shop.timezone, now),
      trialEndsAt: shop.trialEndsAt ? isoDate(shop.trialEndsAt) : null,
      oldestOpenDue: oldestOpen ? isoDate(oldestOpen.dueDate) : null,
      graceDays: BILLING_CONFIG.graceDays,
    });
  }

  private async loadShop(shopId: string): Promise<ShopWithPlan> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: { plan: true },
    });
    if (!shop) throw new NotFoundException('Barbearia não encontrada.');
    return shop;
  }

  private oldestOpenInvoice(shopId: string) {
    return this.prisma.invoice.findFirst({
      where: { shopId, status: 'OPEN' },
      orderBy: { dueDate: 'asc' },
    });
  }

  private async notifyAdmins(shop: Shop, message: string) {
    const admins = await this.prisma.user.findMany({
      where: {
        shopId: shop.id,
        isAdmin: true,
        isActive: true,
        phoneNumber: { not: null },
      },
      select: { phoneNumber: true },
    });
    for (const admin of admins) {
      await this.notifications.platformNotice(admin.phoneNumber!, message);
    }
  }

  /** Como pagar: link do Asaas, quando houver, e as instruções de pagamento por fora. */
  private payLine(invoice: Invoice): string {
    const lines: string[] = [];
    if (invoice.invoiceUrl) lines.push(`Pague online: ${invoice.invoiceUrl}`);
    const text = BILLING_CONFIG.paymentInstructions;
    if (text) lines.push(`Como pagar: ${text}`);
    return lines.length ? `\n${lines.join('\n')}` : '';
  }

  private planView(plan: Plan) {
    return {
      code: plan.code,
      name: plan.name,
      maxBarbers: plan.maxBarbers,
      includedBarbers: plan.includedBarbers,
      monthlyPrice: plan.monthlyPrice.toFixed(2),
      extraBarberPrice: plan.extraBarberPrice?.toFixed(2) ?? null,
    };
  }

  private invoiceView(invoice: Invoice) {
    return {
      id: invoice.id,
      periodStart: isoDate(invoice.periodStart),
      periodEnd: isoDate(invoice.periodEnd),
      dueDate: isoDate(invoice.dueDate),
      planCode: invoice.planCode,
      planName: invoice.planName,
      barbers: invoice.barbers,
      amount: invoice.amount.toFixed(2),
      status: invoice.status,
      paidAt: invoice.paidAt,
      note: invoice.note,
      invoiceUrl: invoice.invoiceUrl,
    };
  }
}

/** As datas da fatura são dias puros, gravados à meia-noite UTC. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDate(date: Date): string {
  const [y, m, d] = isoDate(date).split('-');
  return `${d}/${m}/${y}`;
}

function formatBRL(value: { toString(): string } | string): string {
  return `R$ ${Number(value.toString()).toFixed(2).replace('.', ',')}`;
}

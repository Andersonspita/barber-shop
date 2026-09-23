import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Invoice, InvoiceStatus, Plan, Prisma, Shop } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShopSettingsService } from '../shop/shop-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
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

const PLATFORM_NAME = 'Gerente Barber';

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

/**
 * Mensalidade das barbearias.
 *
 * Sem operadora de pagamento por enquanto: a fatura é gerada aqui, a
 * barbearia paga por fora (Pix, transferência) e quem opera a plataforma dá
 * a baixa. O atraso além da tolerância pausa só o agendamento online — a
 * agenda já marcada, o painel e o encaixe de balcão continuam funcionando,
 * para ninguém ficar sem atender e o admin conseguir regularizar.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shops: ShopSettingsService,
    private readonly notifications: NotificationsService,
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

    if (options.notify !== false) {
      await this.notifyAdmins(
        shop,
        `Olá! A mensalidade do ${PLATFORM_NAME} para a ${shop.name} está disponível.\n\n` +
          `📋 Plano ${invoice.planName} · ${barbers} profissional(is)\n` +
          `💰 ${formatBRL(amount)}\n` +
          `🗓️ Vencimento: ${formatDate(invoice.dueDate)}\n` +
          this.instructionsLine(),
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

  /** Baixa manual: pagamento recebido por fora, ou cancelamento. */
  async setInvoiceStatus(
    invoiceId: string,
    status: InvoiceStatus,
    note?: string,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada.');

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        paidAt: status === 'PAID' ? new Date() : null,
        ...(note !== undefined ? { note: note.trim() || null } : {}),
      },
    });
    return this.invoiceView(updated);
  }

  // ------------------------------------------------------------ rotina diária

  /**
   * Roda de hora em hora: gera as faturas que chegaram na antecedência e
   * avisa no WhatsApp quem venceu e quem entrou no bloqueio. Cada aviso é
   * marcado na fatura, então rodar de novo não repete mensagem.
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
      await this.notifyAdmins(
        shop,
        `O agendamento online da ${shop.name} foi pausado: a mensalidade de ${formatBRL(oldest.amount)}, vencida em ${due}, continua em aberto.\n\n` +
          `A agenda já marcada e o painel continuam funcionando. Assim que o pagamento for confirmado, o agendamento volta na hora.\n` +
          this.instructionsLine(),
      );
      await this.prisma.invoice.update({
        where: { id: oldest.id },
        data: {
          blockedNotifiedAt: now,
          overdueNotifiedAt: oldest.overdueNotifiedAt ?? now,
        },
      });
    } else if (status === 'PAST_DUE' && !oldest.overdueNotifiedAt) {
      const pauseOn = formatDate(
        dateOnlyToUtcMidnight(
          addDaysISO(isoDate(oldest.dueDate), BILLING_CONFIG.graceDays + 1),
        ),
      );
      await this.notifyAdmins(
        shop,
        `A mensalidade da ${shop.name} (${formatBRL(oldest.amount)}) venceu em ${due}.\n\n` +
          `Se não for paga, o agendamento online será pausado em ${pauseOn}.\n` +
          this.instructionsLine(),
      );
      await this.prisma.invoice.update({
        where: { id: oldest.id },
        data: { overdueNotifiedAt: now },
      });
    }
  }

  // ---------------------------------------------------------------- internos

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

  private instructionsLine(): string {
    const text = BILLING_CONFIG.paymentInstructions;
    return text ? `\nComo pagar: ${text}` : '';
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

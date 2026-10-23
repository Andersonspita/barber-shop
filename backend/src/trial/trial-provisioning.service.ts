import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma, Shop } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { isValidSlug } from '../common/shop-context';
import { generateTemporaryPassword } from '../common/password.util';
import { DEFAULT_SHIFTS } from '../common/default-schedule';
import { createPasswordSetupLink } from '../auth/password-setup.util';
import { BillingService } from '../billing/billing.service';
import { CreateTrialDto } from './dto';

const DEFAULT_TRIAL_DAYS = 7;
const MAX_SLUG_SUFFIX = 9;
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/** Códigos de plano que o SDR usava antes da tabela de planos. */
const LEGACY_PLAN_CODES: Record<string, string> = {
  SOLO: 'solo',
  SQUAD: 'essencial',
  PRO: 'profissional',
  EMPIRE: 'premium',
};

/**
 * Cardápio inicial: o SDR promete uma vitrine "pronta para testar hoje", e uma
 * barbearia sem serviço não aceita agendamento. O dono ajusta preços e nomes
 * no painel.
 */
export const DEFAULT_TRIAL_SERVICES = [
  {
    name: 'Corte',
    description: 'Corte masculino',
    durationMinutes: 30,
    price: '45.00',
  },
  {
    name: 'Barba',
    description: 'Barba com toalha quente',
    durationMinutes: 30,
    price: '35.00',
  },
  {
    name: 'Corte + Barba',
    description: 'Combo completo',
    durationMinutes: 60,
    price: '70.00',
  },
];

function setupLinkTtlMinutes(): number {
  return Number(process.env.TRIAL_SETUP_LINK_TTL_HOURS ?? 72) * 60;
}

function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

/** Normaliza um slug sugerido para o formato aceito pela plataforma. */
export function normalizeSlugBase(raw: string): string {
  const base = raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    // Deixa espaço para o sufixo "-N" sem estourar os 40 caracteres.
    .slice(0, 37)
    .replace(/-+$/g, '');
  return base.length >= 3 ? base : `barbearia-${base || 'nova'}`.slice(0, 37);
}

/** Endereços tentados em ordem: o pedido, depois -2 ... -9. */
export function slugCandidates(raw: string): string[] {
  const base = normalizeSlugBase(raw);
  const candidates = [base];
  for (let n = 2; n <= MAX_SLUG_SUFFIX; n++) candidates.push(`${base}-${n}`);
  return candidates.filter(isValidSlug);
}

export interface ProvisionedTrial {
  created: boolean;
  shop: {
    id: string;
    slug: string;
    name: string;
    url: string;
    /** Sempre TRIAL na criação; a situação real vem da cobrança. */
    subscriptionStatus: string;
    plan: string | null;
    trialEndsAt: string | null;
  };
  admin: { id: string; email: string } | null;
  /** Link de uso único para o dono criar a senha. Nulo se ele já entrou. */
  setupUrl: string | null;
}

@Injectable()
export class TrialProvisioningService {
  private readonly logger = new Logger(TrialProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  /**
   * Cria a barbearia em teste grátis com o primeiro admin, jornada e serviços.
   * Repetir o pedido para o mesmo lead devolve a barbearia já criada (com um
   * link novo, se o dono ainda não definiu a senha).
   */
  async provision(input: CreateTrialDto): Promise<ProvisionedTrial> {
    const existing = await this.prisma.shop.findUnique({
      where: { externalLeadId: input.externalLeadId },
    });
    if (existing) return this.describe(existing, false);

    for (const slug of slugCandidates(input.slug || input.shopName)) {
      const taken = await this.prisma.shop.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (taken) continue;

      try {
        const shop = await this.create(slug, input);
        this.logger.log(
          `Teste grátis criado: ${shop.slug} (lead ${input.externalLeadId})`,
        );
        return this.describe(shop, true);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Corrida: outro pedido criou o mesmo lead ou o mesmo slug agora há pouco.
        const raced = await this.prisma.shop.findUnique({
          where: { externalLeadId: input.externalLeadId },
        });
        if (raced) return this.describe(raced, false);
      }
    }

    throw new ConflictException(
      `Nenhum endereço livre a partir de "${input.slug}". Envie outro slug.`,
    );
  }

  private async create(slug: string, input: CreateTrialDto): Promise<Shop> {
    // O dono nunca vê esta senha: ele cria a própria pelo link de acesso.
    const passwordHash = await bcrypt.hash(generateTemporaryPassword(16), 10);
    const planCode = await this.resolvePlanCode(input.plan);
    const trialEndsAt = this.billing.trialEndFor(
      DEFAULT_TIMEZONE,
      input.trialDays ?? DEFAULT_TRIAL_DAYS,
    );

    return this.prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          slug,
          name: input.shopName,
          city: input.city || null,
          phone: input.adminPhone,
          whatsapp: input.adminPhone,
          timezone: DEFAULT_TIMEZONE,
          planCode,
          trialEndsAt,
          externalLeadId: input.externalLeadId,
        },
      });

      const admin = await tx.user.create({
        data: {
          shopId: shop.id,
          name: input.adminName,
          email: input.adminEmail,
          phoneNumber: input.adminPhone,
          passwordHash,
          role: 'BARBER',
          isAdmin: true,
          mustChangePassword: true,
          commissionRate: 0.5,
        },
        select: { id: true },
      });

      await tx.workingHours.createMany({
        data: DEFAULT_SHIFTS.map((shift) => ({ ...shift, barberId: admin.id })),
      });
      await tx.service.createMany({
        data: DEFAULT_TRIAL_SERVICES.map((service) => ({
          ...service,
          shopId: shop.id,
        })),
      });

      return shop;
    });
  }

  /** Plano pedido pelo SDR (código novo ou antigo); senão, o menor da tabela. */
  private async resolvePlanCode(requested?: string): Promise<string | null> {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { code: true },
    });
    const wanted = requested
      ? (LEGACY_PLAN_CODES[requested.toUpperCase()] ?? requested.toLowerCase())
      : null;
    return (
      plans.find((plan) => plan.code === wanted)?.code ?? plans[0]?.code ?? null
    );
  }

  private async describe(
    shop: Shop,
    created: boolean,
  ): Promise<ProvisionedTrial> {
    const admin = await this.prisma.user.findFirst({
      where: { shopId: shop.id, isAdmin: true, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, mustChangePassword: true },
    });

    // Link novo só enquanto o dono ainda não entrou: depois disso, quem
    // esqueceu a senha usa o "esqueci minha senha" normal.
    const setupUrl =
      admin && (created || (admin.mustChangePassword && !shop.trialActivatedAt))
        ? await createPasswordSetupLink(
            this.prisma,
            admin.id,
            shop.slug,
            setupLinkTtlMinutes(),
          )
        : null;

    return {
      created,
      shop: {
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        url: `${appUrl()}/${shop.slug}`,
        subscriptionStatus: await this.billing.status(shop.id),
        plan: shop.planCode,
        trialEndsAt: shop.trialEndsAt ? shop.trialEndsAt.toISOString() : null,
      },
      admin: admin ? { id: admin.id, email: admin.email } : null,
      setupUrl,
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

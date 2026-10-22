import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { createServer, IncomingHttpHeaders, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BillingService } from '../src/billing/billing.service';
import { TrialLifecycleProcessor } from '../src/trial/trial-lifecycle.processor';

/**
 * Cobrança pelo Asaas, de ponta a ponta, contra Postgres e Redis reais. Um
 * servidor HTTP local faz o papel do Asaas (ASAAS_API_URL) e do SDR-AI.
 *
 *   npm run test:e2e -- billing
 */
const PROVISIONING_KEY = 'chave-e2e-provisionamento';
const PLATFORM_KEY = 'chave-e2e-plataforma';
const ASAAS_WEBHOOK_TOKEN = 'token-e2e-webhook-asaas-com-32-caracteres';
const CPF = '529.982.247-25';
const RUN = Date.now().toString(36);

// Provisionar, criar senha (bcrypt) e logar passa dos 5 s padrão do Jest.
jest.setTimeout(30_000);

interface FakeCall {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  body: Record<string, unknown> | null;
}
interface TrialBody {
  shop: { id: string; slug: string };
  setupUrl: string;
}
interface SubscribeBody {
  invoiceUrl: string;
  price: number;
}

describe('Cobrança pelo Asaas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fake: Server;
  const calls: FakeCall[] = [];
  const sdrEvents: Array<{ event: string; shop: { externalLeadId: string } }> =
    [];
  const createdShopIds: string[] = [];
  let subscriptionSeq = 0;
  let customerSeq = 0;

  const shop = { id: '', slug: '', token: '', leadId: `lead-bill-${RUN}` };

  beforeAll(async () => {
    fake = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
        const path = req.url ?? '';
        if (path.startsWith('/sdr')) {
          sdrEvents.push(body as (typeof sdrEvents)[number]);
          return res.writeHead(200).end('{}');
        }
        calls.push({
          method: req.method ?? '',
          path,
          headers: req.headers,
          body,
        });
        const reply = (data: unknown) =>
          res
            .writeHead(200, { 'Content-Type': 'application/json' })
            .end(JSON.stringify(data));

        if (req.method === 'POST' && path === '/v3/customers') {
          return reply({ id: `cus_${RUN}_${++customerSeq}` });
        }
        if (req.method === 'POST' && path === '/v3/subscriptions') {
          return reply({ id: `sub_${RUN}_${++subscriptionSeq}` });
        }
        const payments = path.match(/^\/v3\/subscriptions\/([^/]+)\/payments$/);
        if (payments) {
          return reply({
            data: [
              {
                id: `pay_${payments[1]}`,
                status: 'PENDING',
                value: 1,
                dueDate: '2026-10-23',
                subscription: payments[1],
                invoiceUrl: `https://asaas.test/i/${payments[1]}`,
              },
            ],
          });
        }
        if (req.method === 'DELETE') return reply({ deleted: true });
        res.writeHead(404).end('{}');
      });
    });
    await new Promise<void>((resolve) => fake.listen(0, resolve));
    const base = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;

    Object.assign(process.env, {
      PROVISIONING_API_KEY: PROVISIONING_KEY,
      PLATFORM_ADMIN_KEY: PLATFORM_KEY,
      SDR_WEBHOOK_URL: `${base}/sdr`,
      SDR_WEBHOOK_SECRET: 'segredo-e2e',
      APP_URL: 'https://barber-shop.test',
      ASAAS_API_KEY: '$aact_hmlg_chave_de_teste',
      ASAAS_API_URL: `${base}/v3`,
      ASAAS_WEBHOOK_TOKEN,
      BILLING_GRACE_DAYS: '5',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    // Barbearia em teste vinda do SDR, com o dono já logado.
    const trial = await provision(shop.leadId, `e2e-bill-${RUN}`);
    shop.id = trial.shop.id;
    shop.slug = trial.shop.slug;
    shop.token = await ownerToken(trial);
  });

  afterAll(async () => {
    if (prisma && createdShopIds.length > 0) {
      await removeShops(prisma, createdShopIds);
    }
    await app?.close();
    await new Promise((resolve) => fake?.close(resolve));
  });

  const http = () => request(app.getHttpServer());

  async function provision(leadId: string, slug: string): Promise<TrialBody> {
    const res = await http()
      .post('/provisioning/trials')
      .set('x-provisioning-key', PROVISIONING_KEY)
      .send({
        externalLeadId: leadId,
        shopName: `Barbearia ${slug}`,
        slug,
        adminName: 'Dono',
        adminEmail: `${slug}@e2e.com`,
        adminPhone: '5577999123456',
      })
      .expect(201);
    const body = res.body as TrialBody;
    createdShopIds.push(body.shop.id);
    return body;
  }

  async function ownerToken(trial: TrialBody): Promise<string> {
    const token = new URL(trial.setupUrl).searchParams.get('token');
    await http()
      .post('/auth/reset-password')
      .send({ token, newPass: 'Dono@Senha123' })
      .expect(201);
    const login = await http()
      .post('/auth/login')
      .set('x-shop', trial.shop.slug)
      .send({ email: `${trial.shop.slug}@e2e.com`, pass: 'Dono@Senha123' })
      .expect(201);
    return (login.body as { access_token: string }).access_token;
  }

  const asOwner = (method: 'get' | 'post', url: string) =>
    http()[method](url).set('Authorization', `Bearer ${shop.token}`);

  const webhook = (
    id: string,
    event: string,
    subscription: string,
    token = ASAAS_WEBHOOK_TOKEN,
  ) =>
    http()
      .post('/billing/asaas/webhook')
      .set('asaas-access-token', token)
      .send({
        id,
        event,
        payment: {
          id: `pay_${id}`,
          subscription,
          status: event === 'PAYMENT_OVERDUE' ? 'OVERDUE' : 'RECEIVED',
          invoiceUrl: `https://asaas.test/i/${id}`,
        },
      });

  const current = () =>
    prisma.shop.findUniqueOrThrow({ where: { id: shop.id } });

  async function waitForSdr(event: string, leadId = shop.leadId) {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (
        sdrEvents.some(
          (e) => e.event === event && e.shop.externalLeadId === leadId,
        )
      ) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Aviso "${event}" não chegou ao SDR`);
  }

  it('só o admin da barbearia vê e assina', async () => {
    await http().get('/admin/billing').set('x-shop', shop.slug).expect(401);
    const res = await asOwner('get', '/admin/billing').expect(200);
    expect(res.body).toMatchObject({
      enabled: true,
      subscriptionStatus: 'TRIAL',
      hasSubscription: false,
    });
  });

  it('recusa CPF/CNPJ inválido sem chamar o Asaas', async () => {
    const before = calls.length;
    await asOwner('post', '/admin/billing/subscribe')
      .send({ plan: 'PRO', method: 'PIX', cpfCnpj: '529.982.247-24' })
      .expect(400);
    expect(calls.length).toBe(before);
  });

  it('cria cliente e assinatura mensal e devolve o link da 1ª fatura', async () => {
    const res = await asOwner('post', '/admin/billing/subscribe')
      .send({ plan: 'PRO', method: 'PIX', cpfCnpj: CPF })
      .expect(201);
    const body = res.body as SubscribeBody;
    expect(body.price).toBe(179.9);
    expect(body.invoiceUrl).toBe(`https://asaas.test/i/sub_${RUN}_1`);

    const customer = calls.find((c) => c.path === '/v3/customers')!;
    expect(customer.headers['access_token']).toBe('$aact_hmlg_chave_de_teste');
    expect(customer.headers['user-agent']).toBe('GerenteBarber/1.0');
    expect(customer.body).toMatchObject({
      cpfCnpj: '52998224725',
      externalReference: shop.id,
    });
    const subscription = calls.find((c) => c.path === '/v3/subscriptions')!;
    expect(subscription.body).toMatchObject({
      customer: `cus_${RUN}_1`,
      billingType: 'PIX',
      value: 179.9,
      cycle: 'MONTHLY',
    });

    // Até pagar, segue em teste com o plano "pendente".
    expect(await current()).toMatchObject({
      subscriptionStatus: 'TRIAL',
      pendingPlan: 'PRO',
      asaasSubscriptionId: `sub_${RUN}_1`,
    });
  });

  it('trocar o plano antes de pagar cancela a assinatura anterior', async () => {
    await asOwner('post', '/admin/billing/subscribe')
      .send({ plan: 'SQUAD', method: 'BOLETO', cpfCnpj: CPF })
      .expect(201);
    expect(
      calls.some(
        (c) =>
          c.method === 'DELETE' && c.path === `/v3/subscriptions/sub_${RUN}_1`,
      ),
    ).toBe(true);
    // O cliente do Asaas é reaproveitado.
    expect(calls.filter((c) => c.path === '/v3/customers')).toHaveLength(1);
    expect(await current()).toMatchObject({
      pendingPlan: 'SQUAD',
      billingMethod: 'BOLETO',
      asaasSubscriptionId: `sub_${RUN}_2`,
    });
  });

  it('webhook: recusa token errado e ignora assinatura antiga', async () => {
    await webhook(
      `evt-x-${RUN}`,
      'PAYMENT_RECEIVED',
      `sub_${RUN}_2`,
      'errado',
    ).expect(401);
    const res = await webhook(
      `evt-old-${RUN}`,
      'PAYMENT_RECEIVED',
      `sub_${RUN}_1`,
    ).expect(200);
    expect(res.body).toMatchObject({ status: 'ignored' });
    expect((await current()).subscriptionStatus).toBe('TRIAL');
  });

  it('pagamento confirmado ativa o plano e avisa o SDR; reenvio é ignorado', async () => {
    const res = await webhook(
      `evt-paid-${RUN}`,
      'PAYMENT_RECEIVED',
      `sub_${RUN}_2`,
    ).expect(200);
    expect(res.body).toMatchObject({
      status: 'processed',
      subscriptionStatus: 'ACTIVE',
    });
    expect(await current()).toMatchObject({
      subscriptionStatus: 'ACTIVE',
      plan: 'SQUAD',
      pendingPlan: null,
      isActive: true,
    });
    await waitForSdr('subscription.activated');

    const again = await webhook(
      `evt-paid-${RUN}`,
      'PAYMENT_RECEIVED',
      `sub_${RUN}_2`,
    ).expect(200);
    expect(again.body).toMatchObject({ status: 'duplicate' });

    await asOwner('post', '/admin/billing/subscribe')
      .send({ plan: 'PRO', method: 'PIX', cpfCnpj: CPF })
      .expect(409);
  });

  it('inadimplência: vence, segue no ar na tolerância, suspende e volta ao pagar', async () => {
    await webhook(
      `evt-overdue-${RUN}`,
      'PAYMENT_OVERDUE',
      `sub_${RUN}_2`,
    ).expect(200);
    let state = await current();
    expect(state).toMatchObject({
      subscriptionStatus: 'PAST_DUE',
      isActive: true,
      billingInvoiceUrl: `https://asaas.test/i/evt-overdue-${RUN}`,
    });
    expect(state.pastDueSince).not.toBeNull();
    await http().get('/shop').set('x-shop', shop.slug).expect(200);

    const billing = app.get(BillingService);
    const fourDays = new Date(state.pastDueSince!.getTime() + 4 * 86_400_000);
    expect(await billing.suspendOverdue(fourDays)).toBe(0);

    const sixDays = new Date(state.pastDueSince!.getTime() + 6 * 86_400_000);
    expect(await billing.suspendOverdue(sixDays)).toBeGreaterThanOrEqual(1);
    state = await current();
    expect(state).toMatchObject({
      subscriptionStatus: 'SUSPENDED',
      isActive: false,
    });
    await http().get('/shop').set('x-shop', shop.slug).expect(404);
    await waitForSdr('subscription.suspended');

    await webhook(`evt-late-${RUN}`, 'PAYMENT_RECEIVED', `sub_${RUN}_2`).expect(
      200,
    );
    expect(await current()).toMatchObject({
      subscriptionStatus: 'ACTIVE',
      isActive: true,
      pastDueSince: null,
    });
    await http().get('/shop').set('x-shop', shop.slug).expect(200);
    await waitForSdr('subscription.reactivated');
  });

  it('plataforma gera a cobrança para um teste vencido e o pagamento devolve ao ar', async () => {
    const leadId = `lead-expired-${RUN}`;
    const expired = await provision(leadId, `e2e-exp-${RUN}`);
    const lifecycle = app.get(TrialLifecycleProcessor);
    await lifecycle.run(new Date(Date.now() + 8 * 86_400_000));
    expect(
      await prisma.shop.findUniqueOrThrow({ where: { id: expired.shop.id } }),
    ).toMatchObject({ subscriptionStatus: 'EXPIRED', isActive: false });

    const res = await http()
      .post(`/platform/shops/${expired.shop.id}/billing`)
      .set('x-platform-key', PLATFORM_KEY)
      .send({ plan: 'SOLO', method: 'PIX', cpfCnpj: '11.222.333/0001-81' })
      .expect(201);
    const { invoiceUrl } = res.body as SubscribeBody;
    expect(invoiceUrl).toContain('asaas.test/i/');

    const sub = (
      await prisma.shop.findUniqueOrThrow({ where: { id: expired.shop.id } })
    ).asaasSubscriptionId!;
    await webhook(`evt-exp-${RUN}`, 'PAYMENT_CONFIRMED', sub).expect(200);
    expect(
      await prisma.shop.findUniqueOrThrow({ where: { id: expired.shop.id } }),
    ).toMatchObject({
      subscriptionStatus: 'ACTIVE',
      plan: 'SOLO',
      isActive: true,
    });
    await waitForSdr('subscription.activated', leadId);
  });

  it('sem chave do Asaas a assinatura responde 503 e sem token o webhook some', async () => {
    const key = process.env.ASAAS_API_KEY;
    const token = process.env.ASAAS_WEBHOOK_TOKEN;
    try {
      delete process.env.ASAAS_API_KEY;
      delete process.env.ASAAS_WEBHOOK_TOKEN;
      await http()
        .post(`/platform/shops/${shop.id}/billing`)
        .set('x-platform-key', PLATFORM_KEY)
        .send({ plan: 'SOLO', method: 'PIX', cpfCnpj: CPF })
        .expect(503);
      await webhook(`evt-off-${RUN}`, 'PAYMENT_RECEIVED', 'x').expect(404);
    } finally {
      process.env.ASAAS_API_KEY = key;
      process.env.ASAAS_WEBHOOK_TOKEN = token;
    }
  });
});

async function removeShops(prisma: PrismaService, shopIds: string[]) {
  const users = { shopId: { in: shopIds } };
  const barbers = { barber: users };
  await prisma.$transaction([
    prisma.workingHours.deleteMany({ where: barbers }),
    prisma.passwordResetToken.deleteMany({ where: { user: users } }),
    prisma.service.deleteMany({ where: users }),
    prisma.user.deleteMany({ where: users }),
    prisma.shop.deleteMany({ where: { id: { in: shopIds } } }),
  ]);
}

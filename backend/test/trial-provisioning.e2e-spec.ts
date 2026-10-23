import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { createServer, IncomingHttpHeaders, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TrialLifecycleProcessor } from '../src/trial/trial-lifecycle.processor';
import { signSdrWebhook } from '../src/trial/sdr-webhook.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { BillingService } from '../src/billing/billing.service';

/**
 * Teste grátis provisionado pelo SDR-AI, de ponta a ponta, contra Postgres e
 * Redis reais (DATABASE_URL, REDIS_HOST/REDIS_PORT e JWT_SECRET no ambiente).
 * Um servidor HTTP local faz o papel do SDR e confere a assinatura de cada
 * aviso, e outro faz o papel da API do Asaas. Rode num banco de teste com a
 * tabela de planos (migrations aplicadas):
 *
 *   npm run test:e2e -- trial-provisioning
 */
const PROVISIONING_KEY = 'chave-e2e-provisionamento';
const PLATFORM_KEY = 'chave-e2e-plataforma';
const WEBHOOK_SECRET = 'segredo-e2e-webhook-sdr';
const ASAAS_TOKEN = 'token-e2e-webhook-asaas';
const DAY = 86_400_000;
const RUN = Date.now().toString(36);

interface ReceivedWebhook {
  headers: IncomingHttpHeaders;
  raw: string;
  body: {
    event: string;
    shop: { externalLeadId: string } & Record<string, unknown>;
  };
}
interface TrialBody {
  created: boolean;
  shop: {
    id: string;
    slug: string;
    url: string;
    subscriptionStatus: string;
    plan: string;
    trialEndsAt: string;
  };
  admin: { id: string; email: string };
  setupUrl: string | null;
}

describe('Teste grátis via SDR-AI (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sdr: Server;
  let asaas: Server;
  const asaasCalls: Array<{
    method: string;
    path: string;
    body: Record<string, unknown>;
  }> = [];
  const received: ReceivedWebhook[] = [];
  const createdShopIds: string[] = [];

  const leadId = `lead-${RUN}`;
  const slug = `e2e-trial-${RUN}`;
  const trialRequest = {
    externalLeadId: leadId,
    shopName: 'Barbearia São José & Cia',
    slug,
    city: 'Vitória da Conquista',
    plan: 'SQUAD', // código antigo do SDR: vira o plano Essencial
    trialDays: 7,
    adminName: 'Marcos Oliveira',
    adminEmail: 'Marcos@E2E.com',
    adminPhone: '5577999123456',
  };
  let trial: TrialBody;
  let trialNotice: jest.SpyInstance;

  beforeAll(async () => {
    sdr = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        received.push({
          headers: req.headers,
          raw,
          body: JSON.parse(raw) as ReceivedWebhook['body'],
        });
        res.writeHead(200).end('{}');
      });
    });
    await new Promise<void>((resolve) => sdr.listen(0, resolve));

    // API do Asaas de mentira: cria cliente e cobrança e devolve o link.
    asaas = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        const body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
        asaasCalls.push({ method: req.method!, path: req.url!, body });
        const reply =
          req.url === '/customers'
            ? { id: `cus_${RUN}` }
            : req.url === '/payments'
              ? {
                  id: `pay_${RUN}`,
                  status: 'PENDING',
                  value: body.value,
                  dueDate: body.dueDate,
                  invoiceUrl: `https://asaas.test/i/${RUN}`,
                  externalReference: body.externalReference,
                }
              : { deleted: true };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reply));
      });
    });
    await new Promise<void>((resolve) => asaas.listen(0, resolve));

    process.env.PROVISIONING_API_KEY = PROVISIONING_KEY;
    process.env.PLATFORM_ADMIN_KEY = PLATFORM_KEY;
    process.env.SDR_WEBHOOK_URL = `http://127.0.0.1:${(sdr.address() as AddressInfo).port}/webhook/barbershop`;
    process.env.SDR_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.APP_URL = 'https://barber-shop.test';
    process.env.ASAAS_API_KEY = 'chave-e2e-asaas';
    process.env.ASAAS_API_URL = `http://127.0.0.1:${(asaas.address() as AddressInfo).port}`;
    process.env.ASAAS_WEBHOOK_TOKEN = ASAAS_TOKEN;

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
    trialNotice = jest.spyOn(app.get(NotificationsService), 'trialNotice');
  });

  afterAll(async () => {
    if (prisma && createdShopIds.length > 0) {
      await removeShops(prisma, createdShopIds);
    }
    await app?.close();
    await new Promise((resolve) => sdr?.close(resolve));
    await new Promise((resolve) => asaas?.close(resolve));
  });

  const provision = (body: object, key = PROVISIONING_KEY) =>
    request(app.getHttpServer())
      .post('/provisioning/trials')
      .set('x-provisioning-key', key)
      .send(body);

  /** Espera o aviso chegar ao "SDR" (a entrega passa pela fila do BullMQ). */
  async function waitForWebhook(event: string): Promise<ReceivedWebhook> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const hit = received.find(
        (w) => w.body.event === event && w.body.shop.externalLeadId === leadId,
      );
      if (hit) return hit;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Aviso "${event}" não chegou ao SDR`);
  }

  it('recusa quem não tem a chave de provisionamento', async () => {
    await provision(trialRequest, 'errada').expect(403);
    await provision(trialRequest, PLATFORM_KEY).expect(403);
  });

  it('cria a barbearia em teste com dono, jornada e serviços', async () => {
    const res = await provision(trialRequest).expect(201);
    trial = res.body as TrialBody;
    createdShopIds.push(trial.shop.id);

    expect(trial.created).toBe(true);
    expect(trial.shop.slug).toBe(slug);
    expect(trial.shop.url).toBe(`https://barber-shop.test/${slug}`);
    expect(trial.shop.subscriptionStatus).toBe('TRIAL');
    expect(trial.shop.plan).toBe('essencial');
    expect(trial.admin.email).toBe('marcos@e2e.com');
    expect(trial.setupUrl).toMatch(
      new RegExp(
        `^https://barber-shop.test/${slug}/login/recuperar\\?token=[a-f0-9]{64}$`,
      ),
    );

    // O fim do teste é um dia: a 1ª fatura vence nele.
    const days =
      (new Date(trial.shop.trialEndsAt).getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(6);
    expect(days).toBeLessThanOrEqual(8);

    const admin = await prisma.user.findUniqueOrThrow({
      where: { id: trial.admin.id },
      include: { workingHours: true },
    });
    expect(admin).toMatchObject({
      isAdmin: true,
      mustChangePassword: true,
      phoneNumber: '5577999123456',
    });
    expect(admin.workingHours).toHaveLength(6);
    expect(
      await prisma.service.count({ where: { shopId: trial.shop.id } }),
    ).toBe(3);

    // A vitrine já está no ar.
    await request(app.getHttpServer())
      .get('/shop')
      .set('x-shop', slug)
      .expect(200);
  });

  it('usa um sufixo quando o endereço já está em uso', async () => {
    const res = await provision({
      ...trialRequest,
      externalLeadId: `${leadId}-outro`,
    }).expect(201);
    const other = res.body as TrialBody;
    createdShopIds.push(other.shop.id);
    expect(other.shop.slug).toBe(`${slug}-2`);
  });

  it('é idempotente por lead e renova o link enquanto o dono não entrou', async () => {
    const res = await provision(trialRequest).expect(200);
    const again = res.body as TrialBody;
    expect(again.created).toBe(false);
    expect(again.shop.id).toBe(trial.shop.id);
    expect(again.setupUrl).toBeTruthy();
    expect(again.setupUrl).not.toBe(trial.setupUrl);
  });

  it('o link de acesso define a senha e marca o teste como ativado', async () => {
    const token = new URL(trial.setupUrl!).searchParams.get('token');
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, newPass: 'Nova@Senha123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-shop', slug)
      .send({ email: 'marcos@e2e.com', pass: 'Nova@Senha123' })
      .expect(201);

    const shop = await prisma.shop.findUniqueOrThrow({
      where: { id: trial.shop.id },
    });
    expect(shop.trialActivatedAt).not.toBeNull();

    const webhook = await waitForWebhook('trial.activated');
    const timestamp = webhook.headers['x-gerente-barber-timestamp'] as string;
    expect(webhook.headers['x-gerente-barber-signature']).toBe(
      `sha256=${signSdrWebhook(WEBHOOK_SECRET, timestamp, webhook.raw)}`,
    );
    expect(webhook.body.shop).toMatchObject({
      id: trial.shop.id,
      subscriptionStatus: 'TRIAL',
    });
    expect(Object.keys(webhook.body.shop).sort()).toEqual([
      'externalLeadId',
      'id',
      'invoiceUrl',
      'name',
      'plan',
      'slug',
      'subscribeUrl',
      'subscriptionStatus',
      'suspendsAt',
      'trialEndsAt',
      'url',
    ]);
    expect(webhook.body.shop).toMatchObject({
      name: 'Barbearia São José & Cia',
      url: `https://barber-shop.test/${slug}`,
      subscribeUrl: `https://barber-shop.test/${slug}/dashboard/assinatura`,
    });

    // Depois do primeiro acesso, repetir o pedido não gera link novo.
    const repeat = (await provision(trialRequest).expect(200))
      .body as TrialBody;
    expect(repeat.setupUrl).toBeNull();
  });

  it('avisa 48h antes do fim do teste, pela conversa do SDR', async () => {
    const lifecycle = app.get(TrialLifecycleProcessor);
    const endsAt = new Date(trial.shop.trialEndsAt);

    await lifecycle.run(new Date(endsAt.getTime() - 60 * 60_000));
    const shop = await prisma.shop.findUniqueOrThrow({
      where: { id: trial.shop.id },
    });
    expect(shop.trialReminderSentAt).not.toBeNull();
    const webhook = await waitForWebhook('trial.expiring');
    expect(webhook.body.shop.subscriptionStatus).toBe('TRIAL');
    // Veio do SDR: os avisos saem pela conversa dele, não pelo WhatsApp da plataforma.
    expect(trialNotice).not.toHaveBeenCalled();
  });

  it('com pagamento online ligado, a 1ª fatura sai com link do Asaas', async () => {
    await request(app.getHttpServer())
      .post(`/platform/shops/${trial.shop.id}/online-payment`)
      .set('x-platform-key', PLATFORM_KEY)
      .send({ cpfCnpj: '529.982.247-25' })
      .expect(201);
    expect(
      asaasCalls.find((call) => call.path === '/customers')?.body,
    ).toMatchObject({
      cpfCnpj: '52998224725',
      externalReference: trial.shop.id,
    });

    const res = await request(app.getHttpServer())
      .post(`/platform/shops/${trial.shop.id}/invoices`)
      .set('x-platform-key', PLATFORM_KEY)
      .expect(201);
    const summary = res.body as {
      openInvoice: { id: string; invoiceUrl: string; dueDate: string };
      onlinePayment: { enabled: boolean };
    };
    expect(summary.onlinePayment.enabled).toBe(true);
    expect(summary.openInvoice.invoiceUrl).toBe(`https://asaas.test/i/${RUN}`);
    expect(summary.openInvoice.dueDate).toBe(
      trial.shop.trialEndsAt.slice(0, 10),
    );
    expect(
      asaasCalls.find((call) => call.path === '/payments')?.body,
    ).toMatchObject({
      customer: `cus_${RUN}`,
      billingType: 'UNDEFINED',
      externalReference: summary.openInvoice.id,
    });

    const webhook = await waitForWebhook('subscription.invoice_created');
    expect(webhook.body.shop.invoiceUrl).toBe(`https://asaas.test/i/${RUN}`);
  });

  it('fatura vencida avisa o fim do teste e, depois da tolerância, pausa o agendamento', async () => {
    const billing = app.get(BillingService);
    const due = new Date(trial.shop.trialEndsAt).getTime();

    // Dois dias depois: em Brasília, "vencimento + 1 dia" em UTC ainda é o próprio dia.
    await billing.runDaily(new Date(due + 2 * DAY));
    const expired = await waitForWebhook('trial.expired');
    expect(expired.body.shop.subscriptionStatus).toBe('PAST_DUE');
    expect(expired.body.shop.suspendsAt).toBeTruthy();

    const late = new Date(due + 10 * DAY);
    await billing.runDaily(late);
    const suspended = await waitForWebhook('subscription.suspended');
    expect(suspended.body.shop.subscriptionStatus).toBe('BLOCKED');
    expect(await billing.status(trial.shop.id, late)).toBe('BLOCKED');

    // Rodar de novo não repete o aviso.
    await billing.runDaily(late);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(
      received.filter(
        (w) =>
          w.body.event === 'subscription.suspended' &&
          w.body.shop.externalLeadId === leadId,
      ),
    ).toHaveLength(1);
    // A vitrine continua no ar: só o agendamento online pausa.
    await request(app.getHttpServer())
      .get('/shop')
      .set('x-shop', slug)
      .expect(200);
    expect(trialNotice).not.toHaveBeenCalled();
  }, 20_000);

  it('o webhook do Asaas exige o token', async () => {
    await request(app.getHttpServer())
      .post('/billing/asaas/webhook')
      .set('asaas-access-token', 'errado')
      .send({ id: `evt_${RUN}`, event: 'PAYMENT_RECEIVED' })
      .expect(401);
  });

  it('pagamento confirmado no Asaas dá baixa na fatura uma vez só', async () => {
    const event = {
      id: `evt_${RUN}`,
      event: 'PAYMENT_RECEIVED',
      payment: { id: `pay_${RUN}` },
    };
    const send = () =>
      request(app.getHttpServer())
        .post('/billing/asaas/webhook')
        .set('asaas-access-token', ASAAS_TOKEN)
        .send(event)
        .expect(200);

    expect((await send()).body).toEqual({ status: 'processed' });
    expect((await send()).body).toEqual({ status: 'duplicate' });

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { asaasPaymentId: `pay_${RUN}` },
    });
    expect(invoice.status).toBe('PAID');
    await waitForWebhook('subscription.activated');
    // A baixa veio do próprio Asaas: nada a cancelar lá.
    expect(asaasCalls.some((call) => call.method === 'DELETE')).toBe(false);
  });

  it('estorno no Asaas reabre a fatura; o RECEIVED depois do CONFIRMED não muda nada', async () => {
    const send = (id: string, event: string) =>
      request(app.getHttpServer())
        .post('/billing/asaas/webhook')
        .set('asaas-access-token', ASAAS_TOKEN)
        .send({ id: `evt_${RUN}_${id}`, event, payment: { id: `pay_${RUN}` } })
        .expect(200);
    const invoiceStatus = async () =>
      (
        await prisma.invoice.findUniqueOrThrow({
          where: { asaasPaymentId: `pay_${RUN}` },
        })
      ).status;

    expect((await send('confirmed', 'PAYMENT_CONFIRMED')).body).toMatchObject({
      status: 'ignored',
    });
    expect((await send('refund', 'PAYMENT_REFUNDED')).body).toEqual({
      status: 'processed',
    });
    expect(await invoiceStatus()).toBe('OPEN');

    await send('again', 'PAYMENT_RECEIVED');
    expect(await invoiceStatus()).toBe('PAID');
  });
});

async function removeShops(prisma: PrismaService, shopIds: string[]) {
  const users = { shopId: { in: shopIds } };
  const barbers = { barber: users };
  await prisma.$transaction([
    prisma.workingHours.deleteMany({ where: barbers }),
    prisma.passwordResetToken.deleteMany({ where: { user: users } }),
    prisma.service.deleteMany({ where: users }),
    prisma.invoice.deleteMany({ where: users }),
    prisma.user.deleteMany({ where: users }),
    prisma.shop.deleteMany({ where: { id: { in: shopIds } } }),
    prisma.billingEvent.deleteMany({
      where: { id: { startsWith: `evt_${RUN}` } },
    }),
  ]);
}

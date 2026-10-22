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

/**
 * Teste grátis provisionado pelo SDR-AI, de ponta a ponta, contra Postgres e
 * Redis reais (DATABASE_URL, REDIS_HOST/REDIS_PORT e JWT_SECRET no ambiente).
 * Um servidor HTTP local faz o papel do SDR e confere a assinatura de cada
 * aviso. Rode num banco de teste:
 *
 *   npm run test:e2e -- trial-provisioning
 */
const PROVISIONING_KEY = 'chave-e2e-provisionamento';
const PLATFORM_KEY = 'chave-e2e-plataforma';
const WEBHOOK_SECRET = 'segredo-e2e-webhook-sdr';
const RUN = Date.now().toString(36);

interface ReceivedWebhook {
  headers: IncomingHttpHeaders;
  raw: string;
  body: { event: string; shop: { externalLeadId: string } };
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
  const received: ReceivedWebhook[] = [];
  const createdShopIds: string[] = [];

  const leadId = `lead-${RUN}`;
  const slug = `e2e-trial-${RUN}`;
  const trialRequest = {
    externalLeadId: leadId,
    shopName: 'Barbearia São José & Cia',
    slug,
    city: 'Vitória da Conquista',
    plan: 'SQUAD',
    trialDays: 7,
    adminName: 'Marcos Oliveira',
    adminEmail: 'Marcos@E2E.com',
    adminPhone: '5577999123456',
  };
  let trial: TrialBody;

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

    process.env.PROVISIONING_API_KEY = PROVISIONING_KEY;
    process.env.PLATFORM_ADMIN_KEY = PLATFORM_KEY;
    process.env.SDR_WEBHOOK_URL = `http://127.0.0.1:${(sdr.address() as AddressInfo).port}/webhook/barbershop`;
    process.env.SDR_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.APP_URL = 'https://barber-shop.test';

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
  });

  afterAll(async () => {
    if (prisma && createdShopIds.length > 0) {
      await removeShops(prisma, createdShopIds);
    }
    await app?.close();
    await new Promise((resolve) => sdr?.close(resolve));
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
    expect(trial.shop.plan).toBe('SQUAD');
    expect(trial.admin.email).toBe('marcos@e2e.com');
    expect(trial.setupUrl).toMatch(
      new RegExp(
        `^https://barber-shop.test/${slug}/login/recuperar\\?token=[a-f0-9]{64}$`,
      ),
    );

    const days =
      (new Date(trial.shop.trialEndsAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);

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
      'plan',
      'slug',
      'subscriptionStatus',
      'trialEndsAt',
    ]);

    // Depois do primeiro acesso, repetir o pedido não gera link novo.
    const repeat = (await provision(trialRequest).expect(200))
      .body as TrialBody;
    expect(repeat.setupUrl).toBeNull();
  });

  it('avisa 48h antes e tira do ar quando o teste vence', async () => {
    const lifecycle = app.get(TrialLifecycleProcessor);
    const endsAt = new Date(trial.shop.trialEndsAt);

    await lifecycle.run(new Date(endsAt.getTime() - 60 * 60_000));
    let shop = await prisma.shop.findUniqueOrThrow({
      where: { id: trial.shop.id },
    });
    expect(shop.trialReminderSentAt).not.toBeNull();
    expect(shop.subscriptionStatus).toBe('TRIAL');
    await waitForWebhook('trial.expiring');

    await lifecycle.run(new Date(endsAt.getTime() + 60_000));
    shop = await prisma.shop.findUniqueOrThrow({
      where: { id: trial.shop.id },
    });
    expect(shop).toMatchObject({
      subscriptionStatus: 'EXPIRED',
      isActive: false,
    });
    await waitForWebhook('trial.expired');
    await request(app.getHttpServer())
      .get('/shop')
      .set('x-shop', slug)
      .expect(404);
  });

  it('ativar o plano na plataforma devolve a barbearia ao ar', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/platform/shops/${trial.shop.id}`)
      .set('x-platform-key', PLATFORM_KEY)
      .send({ subscriptionStatus: 'ACTIVE', plan: 'PRO' })
      .expect(200);
    expect(res.body).toMatchObject({
      isActive: true,
      subscriptionStatus: 'ACTIVE',
      plan: 'PRO',
    });

    const webhook = await waitForWebhook('subscription.activated');
    expect(webhook.body.shop).toMatchObject({
      subscriptionStatus: 'ACTIVE',
      plan: 'PRO',
    });
    await request(app.getHttpServer())
      .get('/shop')
      .set('x-shop', slug)
      .expect(200);
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

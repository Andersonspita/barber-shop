import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BillingService } from '../src/billing/billing.service';

/**
 * Mensalidade de ponta a ponta, contra Postgres e Redis reais: teste grátis,
 * limite de profissionais, troca de plano, fatura, atraso até a pausa do
 * agendamento online, baixa manual e cortesia.
 *
 * Cria e apaga a própria barbearia; rode num banco de teste.
 *
 *   npm run test:e2e -- billing
 */
const PLATFORM_KEY = 'chave-e2e-mensalidade';
const RUN = Date.now().toString(36);

interface Summary {
  status: string;
  exempt: boolean;
  plan: { code: string; name: string } | null;
  activeBarbers: number;
  trialEndsAt: string | null;
  openInvoice: { id: string; amount: string; dueDate: string } | null;
  invoices: Array<{ id: string; amount: string; status: string }>;
}

describe('Mensalidade (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const slug = `e2e-mensal-${RUN}`;
  let shopId = '';
  let adminToken = '';
  let clientToken = '';
  let serviceId = '';

  const platform = () => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('x-platform-key', PLATFORM_KEY),
    post: (url: string) =>
      request(app.getHttpServer())
        .post(url)
        .set('x-platform-key', PLATFORM_KEY),
    patch: (url: string) =>
      request(app.getHttpServer())
        .patch(url)
        .set('x-platform-key', PLATFORM_KEY),
  });
  const admin = () => ({
    get: (url: string) =>
      request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${adminToken}`),
    post: (url: string) =>
      request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${adminToken}`),
    put: (url: string) =>
      request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${adminToken}`),
  });
  const summary = async () =>
    (await admin().get('/admin/billing').expect(200)).body as Summary;

  beforeAll(async () => {
    process.env.PLATFORM_ADMIN_KEY = PLATFORM_KEY;
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

    const created = await platform()
      .post('/platform/shops')
      .send({
        name: 'Barbearia Mensal',
        slug,
        adminName: 'Dono',
        adminEmail: 'dono@e2e.com',
        trialDays: 14,
      })
      .expect(201);
    const createdBody = created.body as {
      shop: { id: string };
      admin: { temporaryPassword: string };
    };
    shopId = createdBody.shop.id;

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-shop', slug)
      .send({
        email: 'dono@e2e.com',
        pass: createdBody.admin.temporaryPassword,
      })
      .expect(201);
    adminToken = (login.body as { access_token: string }).access_token;

    const service = await admin()
      .post('/admin/services')
      .send({ name: 'Corte', durationMinutes: 30, price: 50 })
      .expect(201);
    serviceId = (service.body as { id: string }).id;

    const signup = await request(app.getHttpServer())
      .post('/auth/signup')
      .set('x-shop', slug)
      .send({
        name: 'Cliente',
        email: 'cliente@e2e.com',
        pass: 'Senha1234',
        phoneNumber: '11999990000',
      })
      .expect(201);
    clientToken = (signup.body as { access_token: string }).access_token;
  });

  afterAll(async () => {
    if (prisma && shopId) {
      const users = { shopId };
      await prisma.$transaction([
        prisma.appointment.deleteMany({ where: users }),
        prisma.workingHours.deleteMany({ where: { barber: users } }),
        prisma.service.deleteMany({ where: users }),
        prisma.user.deleteMany({ where: users }),
        prisma.shop.deleteMany({ where: { id: shopId } }),
      ]);
    }
    await app?.close();
  });

  it('barbearia nova nasce no Solo, em teste grátis', async () => {
    const s = await summary();
    expect(s.plan?.code).toBe('solo');
    expect(s.status).toBe('TRIAL');
    expect(s.trialEndsAt).not.toBeNull();
    expect(s.activeBarbers).toBe(1);
  });

  it('o Solo não aceita um segundo profissional', async () => {
    const res = await admin()
      .post('/admin/barbers')
      .send({ name: 'Segundo', email: 'segundo@e2e.com' })
      .expect(400);
    expect((res.body as { message: string }).message).toMatch(
      /Solo.*Essencial/,
    );
  });

  it('com o Essencial, o segundo profissional entra', async () => {
    await admin()
      .put('/admin/billing/plan')
      .send({ planCode: 'essencial' })
      .expect(200);
    await admin()
      .post('/admin/barbers')
      .send({ name: 'Segundo', email: 'segundo@e2e.com' })
      .expect(201);
    expect((await summary()).activeBarbers).toBe(2);
  });

  it('não volta para um plano menor que a equipe', async () => {
    await admin()
      .put('/admin/billing/plan')
      .send({ planCode: 'solo' })
      .expect(400);
  });

  it('gera a fatura com o valor do plano', async () => {
    await platform().post(`/platform/shops/${shopId}/invoices`).expect(201);
    const s = await summary();
    expect(s.openInvoice?.amount).toBe('89.90');
    // Vence no fim do teste grátis: ainda não está atrasada.
    expect(['TRIAL', 'ACTIVE']).toContain(s.status);
  });

  describe('atraso', () => {
    const daysAgo = (n: number) => {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - n);
      return d;
    };
    const setDue = async (d: Date) => {
      const { openInvoice } = await summary();
      await prisma.invoice.update({
        where: { id: openInvoice!.id },
        data: { dueDate: d },
      });
    };

    it('vencida dentro da tolerância: em atraso, agendamento segue', async () => {
      await setDue(daysAgo(3));
      expect((await summary()).status).toBe('PAST_DUE');
      const shop = await request(app.getHttpServer())
        .get('/shop')
        .set('x-shop', slug)
        .expect(200);
      expect(
        (shop.body as { onlineBookingEnabled: boolean }).onlineBookingEnabled,
      ).toBe(true);
    });

    it('passou da tolerância: pausa só o agendamento online', async () => {
      await setDue(daysAgo(10));
      expect((await summary()).status).toBe('BLOCKED');

      const shop = await request(app.getHttpServer())
        .get('/shop')
        .set('x-shop', slug)
        .expect(200);
      expect(
        (shop.body as { onlineBookingEnabled: boolean }).onlineBookingEnabled,
      ).toBe(false);

      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          serviceId,
          startTime: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        })
        .expect(403);
      expect((res.body as { message: string }).message).toMatch(/pausado/);

      // O painel do admin continua funcionando.
      await admin().get('/admin/clients').expect(200);
    });

    it('a baixa manual libera o agendamento na hora', async () => {
      const { openInvoice } = await summary();
      await platform()
        .patch(`/platform/invoices/${openInvoice!.id}`)
        .send({ status: 'PAID', note: 'Pix recebido' })
        .expect(200);

      const s = await summary();
      expect(s.status).not.toBe('BLOCKED');
      expect(s.openInvoice).toBeNull();
      expect(s.invoices[0].status).toBe('PAID');

      const shop = await request(app.getHttpServer())
        .get('/shop')
        .set('x-shop', slug)
        .expect(200);
      expect(
        (shop.body as { onlineBookingEnabled: boolean }).onlineBookingEnabled,
      ).toBe(true);
    });
  });

  it('a próxima fatura emenda na anterior e usa o preço novo; a antiga não muda', async () => {
    await platform()
      .patch('/platform/plans/essencial')
      .send({ monthlyPrice: 99.9 })
      .expect(200);
    try {
      await platform().post(`/platform/shops/${shopId}/invoices`).expect(201);
      const s = await summary();
      expect(s.invoices).toHaveLength(2);
      expect(s.invoices[0].amount).toBe('99.90');
      expect(s.invoices[1].amount).toBe('89.90');
    } finally {
      await platform()
        .patch('/platform/plans/essencial')
        .send({ monthlyPrice: 89.9 })
        .expect(200);
    }
  });

  it('cortesia: sem limite e sem fatura nova', async () => {
    await platform()
      .patch(`/platform/shops/${shopId}`)
      .send({ billingExempt: true })
      .expect(200);

    const s = await summary();
    expect(s.status).toBe('EXEMPT');

    await platform().post(`/platform/shops/${shopId}/invoices`).expect(400);

    // Essencial comporta 3; em cortesia o quarto entra.
    await admin()
      .post('/admin/barbers')
      .send({ name: 'Terceiro', email: 'terceiro@e2e.com' })
      .expect(201);
    await admin()
      .post('/admin/barbers')
      .send({ name: 'Quarto', email: 'quarto@e2e.com' })
      .expect(201);
  });

  it('a lista da plataforma traz o resumo da cobrança', async () => {
    const res = await platform().get('/platform/shops').expect(200);
    const row = (
      res.body as Array<{
        id: string;
        billing: { status: string; plan: { code: string } };
      }>
    ).find((s) => s.id === shopId);
    expect(row?.billing.status).toBe('EXEMPT');
    expect(row?.billing.plan.code).toBe('essencial');
  });

  describe('rotina automática', () => {
    const dayOffset = (n: number) => {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() + n);
      return d;
    };

    beforeAll(async () => {
      // Sai da cortesia e recomeça do zero, com o teste acabando em 3 dias.
      await prisma.invoice.deleteMany({ where: { shopId } });
      await prisma.shop.update({
        where: { id: shopId },
        data: { billingExempt: false, trialEndsAt: dayOffset(3) },
      });
    });

    it('gera a fatura na antecedência e não duplica ao rodar de novo', async () => {
      const billing = app.get(BillingService);
      await billing.runDaily();
      await billing.runDaily();

      const invoices = await prisma.invoice.findMany({ where: { shopId } });
      expect(invoices).toHaveLength(1);
      expect(invoices[0].dueDate.toISOString().slice(0, 10)).toBe(
        dayOffset(3).toISOString().slice(0, 10),
      );
    });

    it('avisa o atraso e a pausa uma vez cada', async () => {
      const billing = app.get(BillingService);
      const [invoice] = await prisma.invoice.findMany({ where: { shopId } });

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { dueDate: dayOffset(-2) },
      });
      await billing.runDaily();
      let after = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
      });
      expect(after.overdueNotifiedAt).not.toBeNull();
      expect(after.blockedNotifiedAt).toBeNull();

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { dueDate: dayOffset(-10) },
      });
      await billing.runDaily();
      after = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
      });
      expect(after.blockedNotifiedAt).not.toBeNull();
      expect(await billing.status(shopId)).toBe('BLOCKED');
    });
  });
});

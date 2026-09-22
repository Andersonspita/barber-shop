import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Isolamento entre barbearias, de ponta a ponta, contra Postgres e Redis
 * reais (DATABASE_URL, REDIS_HOST/REDIS_PORT e JWT_SECRET no ambiente).
 *
 * O teste cria as próprias barbearias pela API da plataforma, com slugs
 * únicos por execução, e apaga tudo delas no fim — não depende do seed nem
 * toca nos dados das outras barbearias. Ainda assim, rode num banco de teste.
 *
 *   npm run test:e2e -- tenant-isolation
 */
const PLATFORM_KEY = 'chave-e2e-plataforma';

// Formato das respostas usadas no teste — o `body` do supertest é `any`.
interface CreatedShopBody {
  shop: { id: string };
  admin: { temporaryPassword: string };
}
interface SessionBody {
  access_token: string;
  user: { id: string };
}
interface IdBody {
  id: string;
}
interface Slot {
  dateTime: string;
}
const RUN = Date.now().toString(36);

describe('Isolamento entre barbearias (e2e)', () => {
  let app: INestApplication<App>;

  const shopA = { slug: `e2e-a-${RUN}`, token: '', adminId: '', serviceId: '' };
  const shopB = { slug: `e2e-b-${RUN}`, token: '', adminId: '', serviceId: '' };
  let shopBId = '';
  const createdShopIds: string[] = [];

  beforeAll(async () => {
    process.env.PLATFORM_ADMIN_KEY = PLATFORM_KEY;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mesma validação do main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();

    for (const shop of [shopA, shopB]) {
      const created = await request(app.getHttpServer())
        .post('/platform/shops')
        .set('x-platform-key', PLATFORM_KEY)
        .send({
          name: `Barbearia ${shop.slug}`,
          slug: shop.slug,
          adminName: 'Admin',
          adminEmail: 'admin@e2e.com',
        })
        .expect(201);
      const createdBody = created.body as CreatedShopBody;
      createdShopIds.push(createdBody.shop.id);
      if (shop === shopB) shopBId = createdBody.shop.id;

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-shop', shop.slug)
        .send({
          email: 'admin@e2e.com',
          pass: createdBody.admin.temporaryPassword,
        })
        .expect(201);
      const session = login.body as SessionBody;
      shop.token = session.access_token;
      shop.adminId = session.user.id;

      const service = await request(app.getHttpServer())
        .post('/admin/services')
        .set('Authorization', `Bearer ${shop.token}`)
        .send({ name: `Corte ${shop.slug}`, durationMinutes: 30, price: 50 })
        .expect(201);
      shop.serviceId = (service.body as IdBody).id;
    }
  });

  afterAll(async () => {
    if (app && createdShopIds.length > 0) {
      await removeShops(app.get(PrismaService), createdShopIds);
    }
    await app?.close();
  });

  const as = (shop: typeof shopA) => ({
    get: (url: string) =>
      request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${shop.token}`),
    put: (url: string) =>
      request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${shop.token}`),
    patch: (url: string) =>
      request(app.getHttpServer())
        .patch(url)
        .set('Authorization', `Bearer ${shop.token}`),
    post: (url: string) =>
      request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${shop.token}`),
    delete: (url: string) =>
      request(app.getHttpServer())
        .delete(url)
        .set('Authorization', `Bearer ${shop.token}`),
  });

  describe('plataforma', () => {
    it('recusa quem não tem a chave', async () => {
      await request(app.getHttpServer()).get('/platform/shops').expect(403);
      await request(app.getHttpServer())
        .get('/platform/shops')
        .set('x-platform-key', 'errada')
        .expect(403);
    });

    it('recusa slug reservado ou já usado', async () => {
      const base = { name: 'X', adminName: 'A', adminEmail: 'a@a.com' };
      await request(app.getHttpServer())
        .post('/platform/shops')
        .set('x-platform-key', PLATFORM_KEY)
        .send({ ...base, slug: 'dashboard' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/platform/shops')
        .set('x-platform-key', PLATFORM_KEY)
        .send({ ...base, slug: shopA.slug })
        .expect(400);
    });
  });

  describe('vitrine pública', () => {
    it('cada barbearia mostra só os próprios serviços', async () => {
      const a = await request(app.getHttpServer())
        .get('/services')
        .set('x-shop', shopA.slug)
        .expect(200);
      const ids = (a.body as Array<{ id: string }>).map((s) => s.id);
      expect(ids).toContain(shopA.serviceId);
      expect(ids).not.toContain(shopB.serviceId);
    });

    it('cada barbearia mostra só a própria equipe', async () => {
      const b = await request(app.getHttpServer())
        .get('/barbers')
        .set('x-shop', shopB.slug)
        .expect(200);
      const ids = (b.body as Array<{ id: string }>).map((s) => s.id);
      expect(ids).toEqual([shopB.adminId]);
    });

    it('slug desconhecido dá 404', async () => {
      await request(app.getHttpServer())
        .get('/services')
        .set('x-shop', `nao-existe-${RUN}`)
        .expect(404);
    });

    it('horários de um serviço de outra barbearia dão 404', async () => {
      await request(app.getHttpServer())
        .get('/appointments/availability')
        .query({ date: nextWeekday(), serviceId: shopB.serviceId })
        .set('x-shop', shopA.slug)
        .expect(404);
    });
  });

  describe('contas', () => {
    it('o mesmo e-mail tem contas independentes em cada barbearia', async () => {
      const signup = (slug: string) =>
        request(app.getHttpServer())
          .post('/auth/signup')
          .set('x-shop', slug)
          .send({
            name: 'Cliente Duplo',
            email: `duplo-${RUN}@e2e.com`,
            pass: 'Senha1234',
            phoneNumber: '11999990000',
          });

      const a = await signup(shopA.slug).expect(201);
      const b = await signup(shopB.slug).expect(201);
      expect((a.body as SessionBody).user.id).not.toBe(
        (b.body as SessionBody).user.id,
      );
    });

    it('não entra com a conta de uma barbearia na outra', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-shop', shopB.slug)
        .send({ email: `duplo-${RUN}@e2e.com`, pass: 'Errada123' })
        .expect(401);
    });

    it('token de uma barbearia é recusado na página de outra', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${shopA.token}`)
        .set('x-shop', shopB.slug)
        .expect(401);
    });
  });

  describe('painel do admin', () => {
    it('lista de clientes só traz os da própria barbearia', async () => {
      const res = await as(shopB).get('/admin/clients').expect(200);
      const { items } = res.body as { items: Array<{ email: string }> };
      const emails = items.map((c) => c.email);
      expect(emails).toEqual([`duplo-${RUN}@e2e.com`]);
    });

    it('não edita nem desativa serviço de outra barbearia', async () => {
      await as(shopB)
        .put(`/admin/services/${shopA.serviceId}`)
        .send({ name: 'Invadido', durationMinutes: 30, price: 1 })
        .expect(404);
      await as(shopB).delete(`/admin/services/${shopA.serviceId}`).expect(404);
    });

    it('não mexe na equipe de outra barbearia', async () => {
      await as(shopB)
        .get(`/admin/barbers/${shopA.adminId}/working-hours`)
        .expect(404);
      await as(shopB).delete(`/admin/barbers/${shopA.adminId}`).expect(404);
      await as(shopB)
        .post(`/admin/barbers/${shopA.adminId}/reset-password`)
        .expect(404);
    });

    it('não vincula serviço de outra barbearia a um barbeiro', async () => {
      await as(shopB)
        .put(`/admin/barbers/${shopB.adminId}/services`)
        .send({ services: [{ serviceId: shopA.serviceId }] })
        .expect(400);
    });

    it('não bloqueia a agenda de barbeiro de outra barbearia', async () => {
      const start = new Date(Date.now() + 3 * 86_400_000);
      await as(shopB)
        .post('/schedule-blocks')
        .send({
          barberId: shopA.adminId,
          startTime: start.toISOString(),
          endTime: new Date(start.getTime() + 3_600_000).toISOString(),
        })
        .expect(404);
    });

    it('as duas podem cadastrar o mesmo feriado', async () => {
      await as(shopA)
        .post('/admin/holidays')
        .send({ date: '2030-12-25', description: 'Natal' })
        .expect(201);
      await as(shopB)
        .post('/admin/holidays')
        .send({ date: '2030-12-25', description: 'Natal' })
        .expect(201);
      const list = await as(shopA).get('/admin/holidays').expect(200);
      expect(list.body).toHaveLength(1);
    });
  });

  describe('agendamentos', () => {
    let appointmentId = '';

    beforeAll(async () => {
      const date = nextWeekday();
      const slots = await request(app.getHttpServer())
        .get('/appointments/availability')
        .query({ date, serviceId: shopA.serviceId })
        .set('x-shop', shopA.slug)
        .expect(200);
      const available = slots.body as Slot[];
      expect(available.length).toBeGreaterThan(0);

      const booked = await as(shopA)
        .post('/appointments')
        .send({
          serviceId: shopA.serviceId,
          startTime: available[0].dateTime,
        })
        .expect(201);
      appointmentId = (booked.body as { appointment: IdBody }).appointment.id;
    });

    it('admin de outra barbearia não cancela nem remarca', async () => {
      await as(shopB)
        .patch(`/appointments/${appointmentId}/status`)
        .send({ status: 'CANCELLED' })
        .expect(404);
      await as(shopB)
        .patch(`/appointments/${appointmentId}/reschedule`)
        .send({
          startTime: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        })
        .expect(404);
    });

    it('agenda e financeiro de outra barbearia não mostram o agendamento', async () => {
      const agenda = await as(shopB)
        .get('/appointments/agenda')
        .query({ date: nextWeekday() })
        .expect(200);
      const all = (
        agenda.body as {
          columns: Array<{ appointments: Array<{ id: string }> }>;
        }
      ).columns.flatMap((c) => c.appointments.map((a) => a.id));
      expect(all).not.toContain(appointmentId);

      const today = new Date().toISOString().slice(0, 10);
      const metrics = await as(shopB)
        .get('/appointments/metrics/advanced')
        .query({ startDate: today, endDate: '2099-12-31' })
        .expect(200);
      expect((metrics.body as { totalRevenue: number }).totalRevenue).toBe(0);
    });

    it('encaixe não aceita cliente de outra barbearia', async () => {
      const client = await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-shop', shopA.slug)
        .send({ email: `duplo-${RUN}@e2e.com`, pass: 'Senha1234' })
        .expect(201);

      await as(shopB)
        .post('/appointments/walk-in')
        .send({
          serviceId: shopB.serviceId,
          startTime: new Date(Date.now() + 86_400_000).toISOString(),
          clientId: (client.body as SessionBody).user.id,
          force: true,
        })
        .expect(404);
    });
  });

  describe('troca de endereço', () => {
    it('o slug novo passa a valer na hora e o antigo sai do ar', async () => {
      const oldSlug = shopA.slug;
      const newSlug = `${oldSlug}-novo`;

      await request(app.getHttpServer())
        .patch(`/platform/shops/${createdShopIds[0]}`)
        .set('x-platform-key', PLATFORM_KEY)
        .send({ slug: newSlug })
        .expect(200);

      await request(app.getHttpServer())
        .get('/shop')
        .set('x-shop', oldSlug)
        .expect(404);
      const shop = await request(app.getHttpServer())
        .get('/shop')
        .set('x-shop', newSlug)
        .expect(200);
      expect((shop.body as { slug: string }).slug).toBe(newSlug);

      // A sessão é da barbearia, não do endereço: o token segue válido.
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${shopA.token}`)
        .set('x-shop', newSlug)
        .expect(200);

      shopA.slug = newSlug;
    });

    it('recusa slug já usado por outra barbearia', async () => {
      await request(app.getHttpServer())
        .patch(`/platform/shops/${createdShopIds[0]}`)
        .set('x-platform-key', PLATFORM_KEY)
        .send({ slug: shopB.slug })
        .expect(400);
    });
  });

  describe('suspensão', () => {
    it('barbearia suspensa sai do ar e derruba as sessões', async () => {
      await request(app.getHttpServer())
        .patch(`/platform/shops/${shopBId}`)
        .set('x-platform-key', PLATFORM_KEY)
        .send({ isActive: false })
        .expect(200);

      await request(app.getHttpServer())
        .get('/services')
        .set('x-shop', shopB.slug)
        .expect(404);
      await as(shopB).get('/auth/me').expect(401);

      const directory = await request(app.getHttpServer())
        .get('/shops')
        .expect(200);
      const slugs = (directory.body as Array<{ slug: string }>).map(
        (s) => s.slug,
      );
      expect(slugs).toContain(shopA.slug);
      expect(slugs).not.toContain(shopB.slug);
    });
  });
});

/** Próxima terça a sexta, com folga de 2 dias para a antecedência mínima. */
function nextWeekday(): string {
  const date = new Date(Date.now() + 2 * 86_400_000);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

/** Apaga as barbearias do teste, na ordem que as chaves estrangeiras pedem. */
async function removeShops(prisma: PrismaService, shopIds: string[]) {
  const users = { shopId: { in: shopIds } };
  const barbers = { barber: users };
  await prisma.$transaction([
    prisma.review.deleteMany({ where: { appointment: users } }),
    prisma.waitlistEntry.deleteMany({ where: users }),
    prisma.appointment.deleteMany({ where: users }),
    prisma.barberService.deleteMany({ where: barbers }),
    prisma.workingHours.deleteMany({ where: barbers }),
    prisma.scheduleBlock.deleteMany({ where: barbers }),
    prisma.passwordResetToken.deleteMany({ where: { user: users } }),
    prisma.holiday.deleteMany({ where: users }),
    prisma.service.deleteMany({ where: users }),
    prisma.user.deleteMany({ where: users }),
    prisma.shop.deleteMany({ where: { id: { in: shopIds } } }),
  ]);
}

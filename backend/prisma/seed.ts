import 'dotenv/config';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/** Segunda a sexta 09h-18h com pausa 12h-13h; sábado 09h-14h corrido. */
const WEEK_SHIFTS = [
  ...[1, 2, 3, 4, 5].flatMap((weekday) => [
    { weekday, startMinute: 9 * 60, endMinute: 12 * 60 },
    { weekday, startMinute: 13 * 60, endMinute: 18 * 60 },
  ]),
  { weekday: 6, startMinute: 9 * 60, endMinute: 14 * 60 },
];

interface ShopSeed {
  slug: string;
  /** Plano da mensalidade (os planos vêm da migração). */
  planCode: string;
  /** Dias de teste grátis a partir de hoje. */
  trialDays: number;
  settings: {
    name: string;
    timezone: string;
    addressLine: string;
    city: string;
    mapsUrl: string;
    phone: string;
    whatsapp: string;
    instagram: string;
    about: string;
  };
  services: Array<{
    name: string;
    description: string;
    durationMinutes: number;
    price: number;
  }>;
  barbers: Array<{
    name: string;
    email: string;
    phoneNumber: string;
    isAdmin?: boolean;
    commissionRate: number;
    bio: string;
    /** Serviços que o barbeiro executa; ausente = todos. */
    only?: string[];
  }>;
}

/**
 * Duas barbearias, para que o isolamento entre elas possa ser visto na hora:
 * cada uma com equipe, serviços e preços próprios, e o mesmo cliente
 * (mesmo e-mail) cadastrado nas duas como contas independentes.
 */
const SHOPS: ShopSeed[] = [
  {
    slug: 'principal',
    planCode: 'essencial',
    trialDays: 14,
    settings: {
      name: 'Gerente Barber',
      timezone: 'America/Sao_Paulo',
      addressLine: 'Rua das Tesouras, 120 — Centro',
      city: 'São Paulo, SP',
      mapsUrl: 'https://maps.google.com/?q=Rua+das+Tesouras+120',
      phone: '(11) 3000-0000',
      whatsapp: '11900000000',
      instagram: 'gerentebarber',
      about:
        'Barbearia de bairro desde 2014. Corte, barba e cuidado sem pressa, com hora marcada.',
    },
    services: [
      {
        name: 'Corte',
        description:
          'Corte na tesoura ou máquina, com lavagem e finalização. O clássico da casa.',
        durationMinutes: 30,
        price: 45,
      },
      {
        name: 'Corte + Barba',
        description:
          'O combo completo: corte, barba modelada na navalha e toalha quente.',
        durationMinutes: 60,
        price: 75,
      },
      {
        name: 'Barba',
        description:
          'Modelagem na navalha com toalha quente, óleo e finalização com bálsamo.',
        durationMinutes: 30,
        price: 35,
      },
      {
        name: 'Corte infantil',
        description:
          'Para os pequenos até 10 anos, com paciência e sem pressa.',
        durationMinutes: 30,
        price: 40,
      },
    ],
    barbers: [
      {
        name: 'João Ferreira',
        email: 'joao@barbearia.com',
        phoneNumber: '11911111111',
        isAdmin: true,
        commissionRate: 0.5,
        bio: 'Especialista em degradê e barba na navalha. Na cadeira desde 2012.',
      },
      {
        name: 'Maria Souza',
        email: 'maria@barbearia.com',
        phoneNumber: '11922222222',
        commissionRate: 0.45,
        bio: 'Corte clássico e infantil. Mão leve e conversa boa.',
        // Maria não faz o combo longo.
        only: ['Corte', 'Barba', 'Corte infantil'],
      },
    ],
  },
  {
    slug: 'navalha-de-ouro',
    planCode: 'solo',
    trialDays: 14,
    settings: {
      name: 'Navalha de Ouro',
      timezone: 'America/Recife',
      addressLine: 'Av. Boa Viagem, 900 — Boa Viagem',
      city: 'Recife, PE',
      mapsUrl: 'https://maps.google.com/?q=Av+Boa+Viagem+900',
      phone: '(81) 3000-0000',
      whatsapp: '81900000000',
      instagram: 'navalhadeouro',
      about:
        'Barbearia clássica à beira-mar. Navalha, toalha quente e um café enquanto espera.',
    },
    services: [
      {
        name: 'Corte na tesoura',
        description: 'Corte inteiro na tesoura, com lavagem e finalização.',
        durationMinutes: 45,
        price: 60,
      },
      {
        name: 'Barba de navalha',
        description: 'Barba feita na navalha, com toalha quente e bálsamo.',
        durationMinutes: 30,
        price: 40,
      },
      {
        name: 'Pigmentação',
        description: 'Pigmentação de barba ou cabelo para disfarçar falhas.',
        durationMinutes: 40,
        price: 50,
      },
    ],
    barbers: [
      {
        name: 'Rafael Lima',
        email: 'rafael@navalhadeouro.com',
        phoneNumber: '81911111111',
        isAdmin: true,
        commissionRate: 0.5,
        bio: 'Dono da casa. Tesoura e navalha há 15 anos.',
      },
    ],
  },
];

async function seedShop(seed: ShopSeed, passwordHash: string) {
  // A primeira barbearia reaproveita a linha "default" criada pela migração,
  // para que uma base já existente não ganhe uma barbearia duplicada.
  const trialEnd = new Date();
  trialEnd.setUTCHours(0, 0, 0, 0);
  trialEnd.setUTCDate(trialEnd.getUTCDate() + seed.trialDays);
  const billing = {
    planCode: seed.planCode,
    trialEndsAt: trialEnd,
    billingExempt: false,
  };

  const shop = await prisma.shop.upsert({
    where: { slug: seed.slug },
    update: { ...seed.settings, ...billing },
    create: {
      ...(seed.slug === 'principal' ? { id: 'default' } : {}),
      slug: seed.slug,
      ...seed.settings,
      ...billing,
    },
  });

  const services = await Promise.all(
    seed.services.map((data) =>
      prisma.service.create({ data: { ...data, shopId: shop.id } }),
    ),
  );

  const barbers = [];
  for (const barber of seed.barbers) {
    const { only, ...data } = barber;
    const created = await prisma.user.create({
      data: { ...data, shopId: shop.id, passwordHash, role: 'BARBER' },
    });
    barbers.push(created);

    await prisma.workingHours.createMany({
      data: WEEK_SHIFTS.map((shift) => ({ ...shift, barberId: created.id })),
    });

    if (only) {
      await prisma.barberService.createMany({
        data: services
          .filter((s) => only.includes(s.name))
          .map((service) => ({ barberId: created.id, serviceId: service.id })),
      });
    }
  }

  // Mesmo e-mail nas duas barbearias: são contas diferentes, cada uma com a
  // própria senha e histórico.
  const client = await prisma.user.create({
    data: {
      shopId: shop.id,
      name: 'Carlos Visitante',
      email: 'cliente@exemplo.com',
      passwordHash,
      phoneNumber: '11933333333',
      birthDate: new Date('1990-06-15T00:00:00.000Z'),
      role: 'CLIENT',
    },
  });

  return { shop, services, barbers, client };
}

async function main() {
  const passwordHash = await bcrypt.hash('Barbearia123', 10);

  // Limpar tabelas para rodar múltiplas vezes.
  await prisma.review.deleteMany();
  await prisma.waitlistEntry.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.barberService.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.scheduleBlock.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  const rows: Array<Record<string, string>> = [];
  for (const seed of SHOPS) {
    const { shop, barbers, client, services } = await seedShop(
      seed,
      passwordHash,
    );
    for (const barber of barbers) {
      rows.push({
        barbearia: `/${shop.slug}`,
        papel: barber.isAdmin ? 'Admin/Barbeiro' : 'Barbeiro',
        email: barber.email,
        senha: 'Barbearia123',
      });
    }
    rows.push({
      barbearia: `/${shop.slug}`,
      papel: 'Cliente',
      email: client.email,
      senha: 'Barbearia123',
    });
    console.log(`${shop.name}: ${services.length} serviços cadastrados.`);
  }

  console.log('Seed concluído.');
  console.table(rows);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

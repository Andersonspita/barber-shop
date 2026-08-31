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
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  // A migração já cria a linha de configuração com os padrões, então o
  // `update` precisa repetir os campos — com `update: {}` o seed não teria
  // efeito nenhum sobre uma base já migrada.
  const shopDefaults = {
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
  };

  await prisma.shopSettings.upsert({
    where: { id: 'default' },
    update: shopDefaults,
    create: { id: 'default', ...shopDefaults },
  });

  const services = await Promise.all(
    [
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
    ].map((data) => prisma.service.create({ data })),
  );

  const [joao, maria] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'João Ferreira',
        email: 'joao@barbearia.com',
        passwordHash,
        phoneNumber: '11911111111',
        role: 'BARBER',
        isAdmin: true,
        commissionRate: 0.5,
        bio: 'Especialista em degradê e barba na navalha. Na cadeira desde 2012.',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Maria Souza',
        email: 'maria@barbearia.com',
        passwordHash,
        phoneNumber: '11922222222',
        role: 'BARBER',
        commissionRate: 0.45,
        bio: 'Corte clássico e infantil. Mão leve e conversa boa.',
      },
    }),
  ]);

  await prisma.workingHours.createMany({
    data: [joao, maria].flatMap((barber) =>
      WEEK_SHIFTS.map((shift) => ({ ...shift, barberId: barber.id })),
    ),
  });

  // Maria não faz o combo longo; João atende tudo (sem vínculo = faz todos).
  await prisma.barberService.createMany({
    data: services
      .filter((s) => s.name !== 'Corte + Barba')
      .map((service) => ({ barberId: maria.id, serviceId: service.id })),
  });

  const client = await prisma.user.create({
    data: {
      name: 'Carlos Visitante',
      email: 'cliente@exemplo.com',
      passwordHash,
      phoneNumber: '11933333333',
      birthDate: new Date('1990-06-15T00:00:00.000Z'),
      role: 'CLIENT',
    },
  });

  console.log('Seed concluído.');
  console.table([
    { papel: 'Admin/Barbeiro', email: joao.email, senha: 'Barbearia123' },
    { papel: 'Barbeira', email: maria.email, senha: 'Barbearia123' },
    { papel: 'Cliente', email: client.email, senha: 'Barbearia123' },
  ]);
  console.log(`${services.length} serviços e jornada semanal cadastrados.`);
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

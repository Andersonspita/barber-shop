import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Limpar tabelas para rodar múltiplas vezes
  await prisma.appointment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  // 1. Criar um Serviço
  const service = await prisma.service.create({
    data: {
      name: 'Corte + Barba',
      durationMinutes: 45,
      price: 70.00,
    },
  });

  // 2. Criar um Barbeiro
  const barber = await prisma.user.create({
    data: {
      name: 'João Barbeiro',
      email: 'joao@barbearia.com',
      passwordHash: 'hashed123',
      role: 'BARBER',
      isAdmin: true,
    },
  });

  // 3. Criar um Cliente Mockado para testes
  const client = await prisma.user.create({
    data: {
      name: 'Visitante (Web)',
      email: 'visitante@web.com',
      passwordHash: 'hashed123',
      role: 'CLIENT',
    },
  });

  console.log({ service, barber, client });
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

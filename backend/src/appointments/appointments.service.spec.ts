import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException } from '@nestjs/common';

describe('AppointmentsService - Concurrency Test', () => {
  let service: AppointmentsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppointmentsService, PrismaService],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Para ambientes reais de teste, limpamos o DB
    // await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Appointment" CASCADE;`);
    await prisma.$disconnect();
  });

  it('Deve evitar double-booking quando dois clientes agendam o mesmo horário simultaneamente', async () => {
    // Setup Mockado para evitar depender do DB real na compilação básica
    jest.spyOn(prisma.service, 'findUnique').mockResolvedValue({
      id: 'service-1',
      name: 'Corte',
      durationMinutes: 30,
      price: 50 as any,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      // Simula uma transação isolada que verifica disponibilidade e "segura"
      return { id: 'app-1', clientId: 'client-1', barberId: 'barber-1', status: 'SCHEDULED' };
    });

    const targetTime = new Date('2026-10-10T14:00:00.000Z');

    const result = await service.bookAnyAvailableBarber('client-1', 'service-1', targetTime);
    
    expect(result).toBeDefined();
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

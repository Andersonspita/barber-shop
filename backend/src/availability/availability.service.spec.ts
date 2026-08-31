import { BadRequestException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

const SP = 'America/Sao_Paulo';

const SETTINGS = {
  id: 'default',
  name: 'Barbearia',
  timezone: SP,
  slotIntervalMinutes: 30,
  minAdvanceMinutes: 30,
  maxAdvanceDays: 60,
  cancellationWindowMinutes: 120,
  addressLine: null,
  city: null,
  mapsUrl: null,
  phone: null,
  whatsapp: null,
  instagram: null,
  about: null,
  updatedAt: new Date(),
};

const SERVICE = {
  id: 'service-corte',
  name: 'Corte',
  description: null,
  durationMinutes: 30,
  price: 50 as never,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Terça-feira, para cair num dia de expediente padrão. */
const TUESDAY = '2026-03-10';

interface FakeData {
  service?: typeof SERVICE | null;
  barbers?: Array<{ id: string; name: string }>;
  barberServices?: Array<{
    barberId: string;
    serviceId: string;
    priceOverride: unknown;
    durationMinutesOverride: number | null;
  }>;
  workingHours?: Array<{
    barberId: string;
    weekday: number;
    startMinute: number;
    endMinute: number;
  }>;
  appointments?: Array<{ barberId: string; startTime: Date; endTime: Date }>;
  blocks?: Array<{ barberId: string; startTime: Date; endTime: Date }>;
  holiday?: boolean;
}

function build(data: FakeData) {
  const prisma = {
    service: {
      findUnique: jest
        .fn()
        .mockResolvedValue(data.service === undefined ? SERVICE : data.service),
    },
    user: {
      findMany: jest
        .fn()
        .mockResolvedValue(data.barbers ?? [{ id: 'barber-1', name: 'João' }]),
    },
    barberService: {
      findMany: jest.fn().mockResolvedValue(data.barberServices ?? []),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    workingHours: {
      findMany: jest.fn().mockResolvedValue(
        data.workingHours ?? [
          {
            barberId: 'barber-1',
            weekday: 2,
            startMinute: 9 * 60,
            endMinute: 12 * 60,
          },
        ],
      ),
    },
    appointment: { findMany: jest.fn().mockResolvedValue(data.appointments ?? []) },
    scheduleBlock: { findMany: jest.fn().mockResolvedValue(data.blocks ?? []) },
    holiday: {
      findUnique: jest
        .fn()
        .mockResolvedValue(data.holiday ? { id: 'h1', date: new Date() } : null),
    },
  };

  const shop = { get: jest.fn().mockResolvedValue(SETTINGS) };

  return {
    prisma,
    service: new AvailabilityService(prisma as never, shop as never),
  };
}

describe('AvailabilityService', () => {
  /** Bem antes do expediente, para não interferir nas asserções. */
  const earlyMorning = new Date('2026-03-10T06:00:00.000Z');

  it('gera os horários no fuso da barbearia, não no do processo', async () => {
    const { service } = build({});

    const slots = await service.getAvailability(
      TUESDAY,
      SERVICE.id,
      undefined,
      earlyMorning,
    );

    expect(slots[0].time).toBe('09:00');
    // 09:00 em São Paulo é 12:00 UTC.
    expect(slots[0].dateTime).toBe('2026-03-10T12:00:00.000Z');
    expect(slots.at(-1)?.time).toBe('11:30');
  });

  it('não oferece horário que já passou', async () => {
    const { service } = build({});

    // 13:00 UTC = 10:00 em São Paulo, com 30 minutos de antecedência mínima.
    const tenAmLocal = new Date('2026-03-10T13:00:00.000Z');
    const slots = await service.getAvailability(
      TUESDAY,
      SERVICE.id,
      undefined,
      tenAmLocal,
    );

    expect(slots.map((s) => s.time)).toEqual(['10:30', '11:00', '11:30']);
  });

  it('respeita a antecedência mínima configurada', async () => {
    const { service } = build({});

    // 11:50 local: o slot das 12:00 existe, mas está dentro dos 30 minutos.
    const slots = await service.getAvailability(
      TUESDAY,
      SERVICE.id,
      undefined,
      new Date('2026-03-10T14:50:00.000Z'),
    );

    expect(slots).toHaveLength(0);
  });

  it('não oferece horário que não cabe antes do fim do turno', async () => {
    const { service } = build({
      service: { ...SERVICE, durationMinutes: 60 },
      workingHours: [
        {
          barberId: 'barber-1',
          weekday: 2,
          startMinute: 9 * 60,
          endMinute: 10 * 60 + 30,
        },
      ],
    });

    const slots = await service.getAvailability(
      TUESDAY,
      SERVICE.id,
      undefined,
      earlyMorning,
    );

    // Só 09:00 e 09:30 terminam até as 10:30.
    expect(slots.map((s) => s.time)).toEqual(['09:00', '09:30']);
  });

  it('fecha a agenda em feriado', async () => {
    const { service } = build({ holiday: true });

    const slots = await service.getAvailability(
      TUESDAY,
      SERVICE.id,
      undefined,
      earlyMorning,
    );

    expect(slots).toEqual([]);
  });

  it('devolve vazio no dia em que o barbeiro não trabalha', async () => {
    const { service } = build({ workingHours: [] });

    const slots = await service.getAvailability(
      TUESDAY,
      SERVICE.id,
      undefined,
      earlyMorning,
    );

    expect(slots).toEqual([]);
  });

  it('remove os horários ocupados por agendamento', async () => {
    const { service } = build({
      appointments: [
        {
          barberId: 'barber-1',
          startTime: new Date('2026-03-10T12:00:00.000Z'),
          endTime: new Date('2026-03-10T12:30:00.000Z'),
        },
      ],
    });

    const slots = await service.getAvailability(
      TUESDAY,
      SERVICE.id,
      undefined,
      earlyMorning,
    );

    expect(slots.map((s) => s.time)).not.toContain('09:00');
    expect(slots.map((s) => s.time)).toContain('09:30');
  });

  it('remove os horários cobertos por bloqueio de agenda', async () => {
    const { service } = build({
      blocks: [
        {
          barberId: 'barber-1',
          startTime: new Date('2026-03-10T13:00:00.000Z'),
          endTime: new Date('2026-03-10T14:00:00.000Z'),
        },
      ],
    });

    const slots = await service.getAvailability(
      TUESDAY,
      SERVICE.id,
      undefined,
      earlyMorning,
    );

    expect(slots.map((s) => s.time)).toEqual(['09:00', '09:30', '11:00', '11:30']);
  });

  it('consolida barbeiros diferentes no mesmo horário', async () => {
    const { service } = build({
      barbers: [
        { id: 'barber-1', name: 'João' },
        { id: 'barber-2', name: 'Maria' },
      ],
      workingHours: [
        { barberId: 'barber-1', weekday: 2, startMinute: 540, endMinute: 600 },
        { barberId: 'barber-2', weekday: 2, startMinute: 540, endMinute: 600 },
      ],
      appointments: [
        {
          barberId: 'barber-1',
          startTime: new Date('2026-03-10T12:00:00.000Z'),
          endTime: new Date('2026-03-10T12:30:00.000Z'),
        },
      ],
    });

    const slots = await service.getAvailability(
      TUESDAY,
      SERVICE.id,
      undefined,
      earlyMorning,
    );

    expect(slots).toHaveLength(2);
    // 09:00 sobra só para quem está livre.
    expect(slots[0]).toMatchObject({ time: '09:00', barberIds: ['barber-2'] });
    expect(slots[1].barberIds.sort()).toEqual(['barber-1', 'barber-2']);
  });

  it('exclui o barbeiro que não executa o serviço', async () => {
    const { service } = build({
      barbers: [
        { id: 'barber-1', name: 'João' },
        { id: 'barber-2', name: 'Maria' },
      ],
      // João só faz barba; Maria não tem vínculo, então atende tudo.
      barberServices: [
        {
          barberId: 'barber-1',
          serviceId: 'service-barba',
          priceOverride: null,
          durationMinutesOverride: null,
        },
      ],
      workingHours: [
        { barberId: 'barber-1', weekday: 2, startMinute: 540, endMinute: 600 },
        { barberId: 'barber-2', weekday: 2, startMinute: 540, endMinute: 600 },
      ],
    });

    const slots = await service.getAvailability(
      TUESDAY,
      SERVICE.id,
      undefined,
      earlyMorning,
    );

    expect(slots.every((s) => s.barberIds.join() === 'barber-2')).toBe(true);
  });

  it('recusa data anterior a hoje', async () => {
    const { service } = build({});

    await expect(
      service.getAvailability(
        '2026-03-09',
        SERVICE.id,
        undefined,
        new Date('2026-03-10T12:00:00.000Z'),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('recusa data além do horizonte de agendamento', async () => {
    const { service } = build({});

    await expect(
      service.getAvailability('2026-12-31', SERVICE.id, undefined, earlyMorning),
    ).rejects.toThrow(/próximos 60 dias/);
  });

  describe('assertBookable', () => {
    it('recusa horário fora da jornada do profissional', async () => {
      const { service } = build({});

      await expect(
        service.assertBookable(
          'barber-1',
          SERVICE.id,
          // 20:00 local, muito depois do fim do turno.
          new Date('2026-03-10T23:00:00.000Z'),
          {},
          earlyMorning,
        ),
      ).rejects.toThrow(/fora da jornada/);
    });

    it('recusa horário no passado', async () => {
      const { service } = build({});

      await expect(
        service.assertBookable(
          'barber-1',
          SERVICE.id,
          new Date('2026-03-10T12:00:00.000Z'),
          {},
          new Date('2026-03-10T15:00:00.000Z'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite encaixe fora das regras de antecedência', async () => {
      const { service } = build({});

      const result = await service.assertBookable(
        'barber-1',
        SERVICE.id,
        new Date('2026-03-10T12:00:00.000Z'),
        { skipAdvanceRules: true },
        new Date('2026-03-10T12:10:00.000Z'),
      );

      expect(result.endTime.toISOString()).toBe('2026-03-10T12:30:00.000Z');
    });
  });
});

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AppointmentsService, SessionUser } from './appointments.service';

const SETTINGS = {
  timezone: 'America/Sao_Paulo',
  name: 'Barbearia',
  slotIntervalMinutes: 30,
  minAdvanceMinutes: 30,
  maxAdvanceDays: 60,
  cancellationWindowMinutes: 120,
};

const CLIENT: SessionUser = {
  id: 'client-1',
  email: 'cliente@exemplo.com',
  name: 'Cliente',
  role: 'CLIENT',
  isAdmin: false,
};

const BARBER: SessionUser = {
  id: 'barber-1',
  email: 'barbeiro@exemplo.com',
  name: 'Barbeiro',
  role: 'BARBER',
  isAdmin: false,
};

const START = new Date('2026-03-10T18:00:00.000Z');

function build(appointment: Record<string, unknown> = {}) {
  const stored = {
    id: 'appt-1',
    clientId: CLIENT.id,
    barberId: BARBER.id,
    serviceId: 'service-1',
    startTime: START,
    endTime: new Date('2026-03-10T18:30:00.000Z'),
    status: 'SCHEDULED',
    client: { name: 'Cliente', phoneNumber: '11999999999' },
    barber: { name: 'Barbeiro' },
    service: { name: 'Corte' },
    ...appointment,
  };

  const prisma: Record<string, any> = {
    appointment: {
      findUnique: jest.fn().mockResolvedValue(stored),
      update: jest
        .fn()
        .mockImplementation(({ data }) => ({ ...stored, ...data })),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => ({ ...stored, ...data })),
    },
    waitlistEntry: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
  };

  // Atribuído depois porque a transação recebe o próprio cliente como `tx`.
  prisma.$transaction = jest.fn(async (callback: (tx: unknown) => unknown) =>
    typeof callback === 'function' ? callback(prisma) : callback,
  );

  const notifications = {
    appointmentConfirmed: jest.fn(),
    appointmentCancelled: jest.fn(),
    appointmentRescheduled: jest.fn(),
    waitlistSlotOpened: jest.fn(),
  };

  const availability = {
    assertBookable: jest.fn().mockResolvedValue({
      endTime: new Date('2026-03-10T18:30:00.000Z'),
      settings: SETTINGS,
    }),
    effectiveService: jest
      .fn()
      .mockResolvedValue({ durationMinutes: 30, price: 50 }),
    getAvailability: jest.fn().mockResolvedValue([]),
  };

  const shop = { get: jest.fn().mockResolvedValue(SETTINGS) };

  return {
    prisma,
    notifications,
    availability,
    service: new AppointmentsService(
      prisma as never,
      notifications as never,
      availability as never,
      shop as never,
    ),
  };
}

describe('AppointmentsService', () => {
  describe('book', () => {
    it('grava a reserva numa transação serializável', async () => {
      const { service, prisma, notifications } = build();

      await service.book({
        clientId: CLIENT.id,
        serviceId: 'service-1',
        startTime: START,
        preferredBarberId: BARBER.id,
      });

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
      expect(notifications.appointmentConfirmed).toHaveBeenCalled();
    });

    it('congela o preço cobrado no agendamento', async () => {
      const { service, prisma } = build();

      await service.book({
        clientId: CLIENT.id,
        serviceId: 'service-1',
        startTime: START,
        preferredBarberId: BARBER.id,
      });

      expect(prisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priceCharged: 50 }),
        }),
      );
    });

    it('recusa quando o horário foi tomado no meio da transação', async () => {
      const { service, prisma } = build();
      prisma.appointment.findFirst.mockResolvedValue({ id: 'outro' });

      await expect(
        service.book({
          clientId: CLIENT.id,
          serviceId: 'service-1',
          startTime: START,
          preferredBarberId: BARBER.id,
        }),
      ).rejects.toThrow(/acabou de ser preenchido/);
    });
  });

  describe('updateStatus', () => {
    it('deixa o cliente cancelar dentro do prazo', async () => {
      const { service, prisma } = build();

      // 4 horas antes: acima da janela de 2 horas.
      await service.updateStatus(
        'appt-1',
        'CANCELLED',
        CLIENT,
        new Date('2026-03-10T14:00:00.000Z'),
      );

      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('recusa cancelamento do cliente em cima da hora', async () => {
      const { service } = build();

      await expect(
        service.updateStatus(
          'appt-1',
          'CANCELLED',
          CLIENT,
          // 30 minutos antes, dentro da janela de 2 horas.
          new Date('2026-03-10T17:30:00.000Z'),
        ),
      ).rejects.toThrow(/2 horas de antecedência/);
    });

    it('permite que a barbearia cancele a qualquer momento', async () => {
      const { service, prisma } = build();

      await service.updateStatus(
        'appt-1',
        'CANCELLED',
        BARBER,
        new Date('2026-03-10T17:55:00.000Z'),
      );

      expect(prisma.appointment.update).toHaveBeenCalled();
    });

    it('avisa quem estava na lista de espera ao liberar o horário', async () => {
      const { service, prisma, notifications } = build();
      prisma.waitlistEntry.findMany.mockResolvedValue([
        {
          id: 'w1',
          client: { name: 'Outro', phoneNumber: '11988888888' },
          service: { name: 'Corte' },
        },
      ]);

      await service.updateStatus(
        'appt-1',
        'CANCELLED',
        BARBER,
        new Date('2026-03-10T14:00:00.000Z'),
      );

      expect(notifications.waitlistSlotOpened).toHaveBeenCalled();
      expect(prisma.waitlistEntry.updateMany).toHaveBeenCalled();
    });

    it('não conclui antes do horário de início', async () => {
      const { service } = build();

      await expect(
        service.updateStatus(
          'appt-1',
          'COMPLETED',
          BARBER,
          new Date('2026-03-10T17:00:00.000Z'),
        ),
      ).rejects.toThrow(/antes do seu horário de início/);
    });

    it('registra falta somente depois do horário e somente pela barbearia', async () => {
      const { service, prisma } = build();

      await expect(
        service.updateStatus('appt-1', 'NO_SHOW', CLIENT),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.updateStatus(
          'appt-1',
          'NO_SHOW',
          BARBER,
          new Date('2026-03-10T17:00:00.000Z'),
        ),
      ).rejects.toThrow(/ainda não começou/);

      await service.updateStatus(
        'appt-1',
        'NO_SHOW',
        BARBER,
        new Date('2026-03-10T18:30:00.000Z'),
      );
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'NO_SHOW' }),
        }),
      );
    });

    it('impede o cliente de concluir o próprio atendimento', async () => {
      const { service } = build();

      await expect(
        service.updateStatus('appt-1', 'COMPLETED', CLIENT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('impede mexer no agendamento de outra pessoa', async () => {
      const { service } = build();
      const intruder: SessionUser = { ...CLIENT, id: 'client-2' };

      await expect(
        service.updateStatus('appt-1', 'CANCELLED', intruder),
      ).rejects.toThrow(ForbiddenException);
    });

    it('não reabre um agendamento já encerrado', async () => {
      const { service } = build({ status: 'CANCELLED' });

      await expect(
        service.updateStatus('appt-1', 'COMPLETED', BARBER),
      ).rejects.toThrow(/já está como cancelado/);
    });
  });

  describe('reschedule', () => {
    it('reserva o novo horário antes de soltar o antigo', async () => {
      const { service, prisma, notifications } = build();

      await service.reschedule(
        'appt-1',
        new Date('2026-03-11T18:00:00.000Z'),
        BARBER,
      );

      // Uma única atualização move o agendamento; nada é cancelado no caminho.
      expect(prisma.appointment.update).toHaveBeenCalledTimes(1);
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startTime: new Date('2026-03-11T18:00:00.000Z'),
          }),
        }),
      );
      expect(notifications.appointmentRescheduled).toHaveBeenCalled();
    });

    it('mantém o horário original quando o novo já foi tomado', async () => {
      const { service, prisma } = build();
      prisma.appointment.findFirst.mockResolvedValue({ id: 'outro' });

      await expect(
        service.reschedule(
          'appt-1',
          new Date('2026-03-11T18:00:00.000Z'),
          BARBER,
        ),
      ).rejects.toThrow(/agendamento original foi mantido/);

      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    it('não remarca agendamento que já foi concluído', async () => {
      const { service } = build({ status: 'COMPLETED' });

      await expect(
        service.reschedule(
          'appt-1',
          new Date('2026-03-11T18:00:00.000Z'),
          BARBER,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createReview', () => {
    it('só aceita avaliação do cliente atendido e após a conclusão', async () => {
      const pending = build({ status: 'SCHEDULED' });
      await expect(
        pending.service.createReview('appt-1', CLIENT, 5),
      ).rejects.toThrow(/depois do atendimento/);

      const done = build({ status: 'COMPLETED' });
      await expect(
        done.service.createReview('appt-1', BARBER, 5),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

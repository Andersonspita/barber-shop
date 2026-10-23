import {
  NotificationsService,
  WhatsappJob,
  shopLinks,
} from './notifications.service';
import { ShopSettingsService } from '../shop/shop-settings.service';

/**
 * Sem WhatsApp próprio, a barbearia manda pelo número da plataforma, que ninguém
 * lê: a mensagem não pode pedir "responda esta mensagem".
 */
describe('NotificationsService: textos ao cliente', () => {
  const appointment = {
    id: 'a1',
    shopId: 's1',
    startTime: new Date(Date.now() + 26 * 3600_000),
    client: { name: 'João Silva', phoneNumber: '5577999112233' },
    barber: { name: 'Carlos' },
    service: { name: 'Corte' },
  };
  const baseShop = {
    id: 's1',
    slug: 'barbearia-x',
    name: 'Barbearia X',
    timezone: 'America/Sao_Paulo',
    whatsapp: '(77) 98888-7777',
    phone: null,
    whatsappInstance: null as string | null,
  };

  let jobs: WhatsappJob[];
  const build = (shop: typeof baseShop) => {
    jobs = [];
    const queue = {
      add: jest.fn((_name: string, job: WhatsappJob) => {
        jobs.push(job);
        return Promise.resolve();
      }),
      getJob: jest.fn(() => Promise.resolve(null)),
    };
    const settings = { get: jest.fn(() => Promise.resolve(shop)) };
    return new NotificationsService(
      queue as never,
      settings as unknown as ShopSettingsService,
    );
  };

  beforeEach(() => {
    process.env.APP_URL = 'https://bs.test/';
  });

  it('pelo número da plataforma: link das reservas, contato da barbearia e aviso de que não recebe respostas', async () => {
    await build(baseShop).appointmentConfirmed(appointment);
    const [confirmation, reminder] = jobs;

    expect(confirmation.message).toContain(
      'Seu horário na Barbearia X está confirmado',
    );
    expect(confirmation.message).toContain(
      'https://bs.test/barbearia-x/reservas',
    );
    expect(confirmation.message).toContain('https://wa.me/5577988887777');
    expect(confirmation.message).toContain('não recebe respostas');
    expect(confirmation.message).not.toContain('responder esta mensagem');

    expect(reminder.kind).toBe('reminder');
    expect(reminder.message).toContain('https://bs.test/barbearia-x/reservas');
    expect(reminder.message).not.toContain('avise a gente');
  });

  it('com o WhatsApp da própria barbearia: o cliente responde direto', async () => {
    await build({
      ...baseShop,
      whatsappInstance: 'barbearia-x',
    }).appointmentConfirmed(appointment);
    expect(jobs[0].message).toContain('é só responder esta mensagem');
    expect(jobs[0].message).not.toContain('não recebe respostas');
    expect(jobs[1].message).toContain('avise a gente');
  });

  it('cancelamento e vaga trazem o link para agendar', async () => {
    const service = build(baseShop);
    await service.appointmentCancelled(appointment);
    await service.waitlistSlotOpened(
      's1',
      [
        {
          client: { name: 'Ana', phoneNumber: '5577911112222' },
          service: { name: 'Barba' },
        },
      ],
      appointment.startTime,
    );
    expect(jobs[0].message).toContain(
      'https://bs.test/barbearia-x/reservas/nova',
    );
    expect(jobs[1].message).toContain(
      'https://bs.test/barbearia-x/reservas/nova',
    );
  });

  it('contato da barbearia: WhatsApp com DDI, telefone fixo ou nada', () => {
    expect(
      shopLinks({ ...baseShop, whatsapp: '5577988887777' }).shopContact,
    ).toContain('https://wa.me/5577988887777');
    expect(
      shopLinks({ ...baseShop, whatsapp: null, phone: '(77) 3422-1100' })
        .shopContact,
    ).toContain('(77) 3422-1100');
    expect(
      shopLinks({ ...baseShop, whatsapp: null, phone: null }).shopContact,
    ).toBe('');
  });
});

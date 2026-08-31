'use client';

import React, { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  BellRing,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  Clock,
  Scissors,
  User,
} from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/use-session';
import { useAsyncData } from '@/lib/use-async-data';
import {
  addDaysISO,
  formatBRL,
  formatDateLong,
  formatDuration,
  formatTime,
  todayISO,
} from '@/lib/format';
import { buildCalendarEvent, downloadCalendarEvent } from '@/lib/calendar';
import { CLIENT_NAV } from '@/lib/nav';
import { AppHeader, PageHeading } from '@/components/app-header';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string | number;
}

interface Barber {
  id: string;
  name: string;
  photoUrl: string | null;
}

interface Slot {
  time: string;
  dateTime: string;
  available: boolean;
  barberIds: string[];
}

interface BookedAppointment {
  id: string;
  startTime: string;
  endTime: string;
  priceCharged: string | number;
  service: { name: string; durationMinutes: number };
  barber: { name: string };
}

function NewBookingPage() {
  const params = useSearchParams();
  const toast = useToast();
  const { ready } = useSession('CLIENT');

  const [chosenServiceId, setChosenServiceId] = useState('');
  const [barberId, setBarberId] = useState(params.get('barberId') ?? '');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<Slot | null>(null);

  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState<BookedAppointment | null>(null);
  const [waitlisted, setWaitlisted] = useState(false);

  const preselectedService = params.get('serviceId');

  const fetchCatalog = useCallback(async () => {
    if (!ready) return null;
    const [serviceList, barberList] = await Promise.all([
      api<Service[]>('/services'),
      api<Barber[]>('/barbers'),
    ]);
    return { services: serviceList, barbers: barberList };
  }, [ready]);

  const { data: catalog, loading: catalogLoading } = useAsyncData(fetchCatalog);
  const services = catalog?.services ?? [];
  const barbers = catalog?.barbers ?? [];

  // A escolha do usuário vence; sem ela, vale o serviço da URL e, na falta
  // dele, o primeiro do catálogo.
  const serviceId =
    chosenServiceId ||
    (preselectedService && services.some((s) => s.id === preselectedService)
      ? preselectedService
      : (services[0]?.id ?? ''));

  const fetchSlots = useCallback(
    () =>
      serviceId
        ? api<Slot[]>('/appointments/availability', {
            query: { date, serviceId, barberId: barberId || undefined },
          })
        : Promise.resolve([]),
    [date, serviceId, barberId],
  );

  const {
    data: slotData,
    loading: slotsLoading,
    error: slotsError,
    reload: loadSlots,
  } = useAsyncData(fetchSlots);
  const slots = slotData ?? [];

  const service = services.find((s) => s.id === serviceId);

  const handleBook = async () => {
    if (!selected || !service) return;

    setBooking(true);
    try {
      const result = await api<{ appointment: BookedAppointment }>(
        '/appointments',
        {
          method: 'POST',
          auth: true,
          body: {
            serviceId,
            startTime: selected.dateTime,
            barberId: barberId || undefined,
            notes: notes.trim() || undefined,
          },
        },
      );
      setConfirmed(result.appointment);
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : 'Não foi possível concluir o agendamento.';
      toast.error('Agendamento não concluído', message);
      // O horário pode ter sido tomado por outra pessoa: recarrega a grade.
      void loadSlots();
    } finally {
      setBooking(false);
    }
  };

  const handleJoinWaitlist = async () => {
    try {
      await api('/waitlist', {
        method: 'POST',
        auth: true,
        body: { serviceId, date, barberId: barberId || undefined },
      });
      setWaitlisted(true);
      toast.success(
        'Você entrou na lista de espera',
        'Avisamos no WhatsApp se alguém liberar um horário neste dia.',
      );
    } catch (caught) {
      toast.error(
        'Não foi possível entrar na lista',
        caught instanceof ApiError ? caught.message : undefined,
      );
    }
  };

  if (!ready) return null;

  if (confirmed) {
    return (
      <>
        <AppHeader
          area="Portal do cliente"
          subtitle="Agendamento confirmado"
          items={CLIENT_NAV}
        />
        <Confirmation
          appointment={confirmed}
          onNewBooking={() => {
            setConfirmed(null);
            void loadSlots();
          }}
        />
      </>
    );
  }

  return (
    <>
      <AppHeader
        area="Portal do cliente"
        subtitle="Novo agendamento"
        items={CLIENT_NAV}
      />

      <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <PageHeading
          title="Reserve sua cadeira"
          description="Escolha o serviço, quem vai te atender e o melhor horário."
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {/* --------------------------------------------------- serviço */}
            <Card className="p-5 sm:p-6">
              <StepTitle number={1} icon={Scissors} label="Serviço" />

              {catalogLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((index) => (
                    <Skeleton key={index} className="h-24" />
                  ))}
                </div>
              ) : (
                <div
                  role="radiogroup"
                  aria-label="Serviço"
                  className="grid gap-3 sm:grid-cols-2"
                >
                  {services.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={serviceId === item.id}
                      onClick={() => {
                        setChosenServiceId(item.id);
                        setSelected(null);
                        setWaitlisted(false);
                      }}
                      className={cn(
                        'rounded-xl border p-4 text-left transition-colors',
                        serviceId === item.id
                          ? 'border-brand-500 bg-brand-500/10'
                          : 'border-line bg-surface-2 hover:border-line-strong',
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold text-ink">
                          {item.name}
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular text-brand-400">
                          {formatBRL(item.price)}
                        </span>
                      </div>
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-subtle">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatDuration(item.durationMinutes)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* -------------------------------------- profissional e data */}
            <Card className="p-5 sm:p-6">
              <StepTitle number={2} icon={User} label="Profissional e dia" />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Profissional">
                  {(props) => (
                    <Select
                      {...props}
                      value={barberId}
                      onChange={(e) => {
                        setBarberId(e.target.value);
                        setSelected(null);
                        setWaitlisted(false);
                      }}
                    >
                      <option value="">Qualquer um disponível</option>
                      {barbers.map((barber) => (
                        <option key={barber.id} value={barber.id}>
                          {barber.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Field label="Data">
                  {(props) => (
                    <input
                      {...props}
                      type="date"
                      value={date}
                      min={todayISO()}
                      max={addDaysISO(todayISO(), 60)}
                      onChange={(e) => {
                        setDate(e.target.value);
                        setSelected(null);
                        setWaitlisted(false);
                      }}
                      className="h-12 w-full rounded-xl border border-line-strong bg-surface-2 px-4 text-sm text-ink transition-colors focus:border-brand-500"
                    />
                  )}
                </Field>
              </div>

              <div className="mt-4">
                <Field
                  label="Observação para o barbeiro"
                  hint="Opcional. Ex.: máquina 2 nas laterais."
                >
                  {(props) => (
                    <Textarea
                      {...props}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={500}
                      rows={2}
                      placeholder="Alguma preferência?"
                    />
                  )}
                </Field>
              </div>
            </Card>
          </div>

          {/* ---------------------------------------------------- horários */}
          <Card className="flex flex-col p-5 sm:p-6 lg:sticky lg:top-24 lg:self-start">
            <StepTitle number={3} icon={Clock} label="Horário" />

            <div className="min-h-56 flex-1">
              {slotsLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 9 }, (_, index) => (
                    <Skeleton key={index} className="h-11" />
                  ))}
                </div>
              ) : slotsError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
                >
                  {slotsError.message}
                </p>
              ) : slots.length === 0 ? (
                <EmptyDay
                  waitlisted={waitlisted}
                  onJoinWaitlist={handleJoinWaitlist}
                />
              ) : (
                <div
                  role="radiogroup"
                  aria-label="Horários disponíveis"
                  className="scroll-slim grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1"
                >
                  {slots.map((slot) => {
                    const isSelected = selected?.dateTime === slot.dateTime;
                    return (
                      <button
                        key={slot.dateTime}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelected(slot)}
                        className={cn(
                          'h-11 rounded-xl text-sm font-bold tabular transition-colors',
                          isSelected
                            ? 'bg-brand-500 text-surface-0'
                            : 'border border-line bg-surface-2 text-ink hover:border-brand-500/60 hover:text-brand-400',
                        )}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-line pt-5">
              {service && selected && (
                <dl className="mb-4 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-subtle">Serviço</dt>
                    <dd className="font-semibold text-ink">{service.name}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-subtle">Quando</dt>
                    <dd className="font-semibold tabular text-ink">
                      {formatDateLong(date)}, {selected.time}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-subtle">Valor</dt>
                    <dd className="font-bold tabular text-brand-400">
                      {formatBRL(service.price)}
                    </dd>
                  </div>
                </dl>
              )}

              <Button
                size="lg"
                block
                loading={booking}
                disabled={!selected || slotsLoading}
                onClick={handleBook}
              >
                {selected ? `Confirmar às ${selected.time}` : 'Escolha um horário'}
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}

function StepTitle({
  number,
  icon: Icon,
  label,
}: {
  number: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 text-sm font-bold uppercase tracking-wider text-ink-muted">
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-black text-surface-0"
        aria-hidden="true"
      >
        {number}
      </span>
      <Icon className="h-4 w-4 text-brand-400" aria-hidden="true" />
      {label}
    </h2>
  );
}

/**
 * Dia lotado. Antes a tela dizia "Tudo lotado para este dia" e encerrava o
 * assunto — a intenção de compra terminava ali.
 */
function EmptyDay({
  waitlisted,
  onJoinWaitlist,
}: {
  waitlisted: boolean;
  onJoinWaitlist: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-8 text-center">
      <CalendarX2
        className="mb-3 h-8 w-8 text-ink-subtle"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold text-ink">
        Nenhum horário livre neste dia
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Tente outra data — ou avisamos você se alguém desmarcar.
      </p>

      {waitlisted ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs font-bold text-success">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Você está na lista de espera
        </p>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={onJoinWaitlist}
        >
          <BellRing className="h-4 w-4" aria-hidden="true" />
          Avise-me se vagar
        </Button>
      )}
    </div>
  );
}

/** Tela de confirmação: o desfecho que o fluxo antigo não tinha. */
function Confirmation({
  appointment,
  onNewBooking,
}: {
  appointment: BookedAppointment;
  onNewBooking: () => void;
}) {
  const handleAddToCalendar = () => {
    const ics = buildCalendarEvent({
      title: `${appointment.service.name} — Gerente Barber`,
      description: `Com ${appointment.barber.name}.`,
      start: new Date(appointment.startTime),
      end: new Date(appointment.endTime),
    });
    downloadCalendarEvent(ics, 'agendamento-gerente-barber.ics');
  };

  return (
    <main id="conteudo" className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6">
      <Card className="p-6 text-center sm:p-8">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success/12 text-success">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </span>

        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
          Horário confirmado!
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Enviamos os detalhes no seu WhatsApp e um lembrete chega 2 horas
          antes.
        </p>

        <dl className="mt-7 divide-y divide-line rounded-xl border border-line bg-surface-2 text-left text-sm">
          <Row label="Serviço" value={appointment.service.name} />
          <Row label="Profissional" value={appointment.barber.name} />
          <Row
            label="Data"
            value={formatDateLong(appointment.startTime)}
          />
          <Row
            label="Horário"
            value={`${formatTime(appointment.startTime)} — ${formatTime(appointment.endTime)}`}
          />
          <Row label="Valor" value={formatBRL(appointment.priceCharged)} />
        </dl>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" block onClick={handleAddToCalendar}>
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Adicionar à agenda
          </Button>
          <ButtonLink href="/reservas" block>
            Ver minhas reservas
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={onNewBooking}
          className="mt-5 text-sm font-semibold text-ink-muted transition-colors hover:text-brand-400"
        >
          Marcar outro horário
        </button>
      </Card>

      <p className="mt-6 text-center text-sm text-ink-subtle">
        Precisa mudar?{' '}
        <Link
          href="/reservas"
          className="font-semibold text-ink-muted transition-colors hover:text-brand-400"
        >
          Remarque ou cancele em Minhas reservas
        </Link>
        .
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewBookingPage />
    </Suspense>
  );
}

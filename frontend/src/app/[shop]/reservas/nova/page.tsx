'use client';

import React, { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  BellRing,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  Check,
  CheckCircle2,
  Clock,
  Scissors,
  User,
  Users,
} from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/use-session';
import { useAsyncData } from '@/lib/use-async-data';
import {
  addDaysISO,
  dayPeriod,
  formatBRL,
  formatDateLong,
  formatDayMonth,
  formatDuration,
  formatTime,
  formatWeekdayShort,
  parseISODate,
  todayISO,
} from '@/lib/format';
import { buildCalendarEvent, downloadCalendarEvent } from '@/lib/calendar';
import { CLIENT_NAV } from '@/lib/nav';
import { AppHeader, PageHeading } from '@/components/app-header';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Field, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { useShop } from '@/lib/shop-context';

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
  const shop = useShop();

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

  if (!shop.onlineBookingEnabled) {
    return (
      <>
        <AppHeader
          area="Portal do cliente"
          subtitle="Novo agendamento"
          items={CLIENT_NAV}
        />
        <main
          id="conteudo"
          className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6"
        >
          <EmptyState
            icon={<CalendarX2 className="h-6 w-6" aria-hidden="true" />}
            title="Agendamento online indisponível no momento"
            description={`Para marcar seu horário, fale direto com a ${shop.name}. Seus horários já marcados continuam valendo.`}
            action={
              shop.whatsapp ? (
                <ButtonLink
                  href={`https://wa.me/${shop.whatsapp.replace(/\D/g, '')}`}
                  variant="success"
                >
                  Chamar no WhatsApp
                </ButtonLink>
              ) : undefined
            }
          />
        </main>
      </>
    );
  }

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

      <main
        id="conteudo"
        className="mx-auto w-full max-w-6xl px-4 pb-32 pt-8 sm:px-6 lg:pb-8"
      >
        <PageHeading
          title="Reserve sua cadeira"
          description="Escolha o serviço, quem vai te atender e o melhor horário."
        />

        {/* `grid-cols-1` e `min-w-0`: sem eles as fitas roláveis de
            profissional e de dia esticam a coluna e a página inteira
            ganha rolagem horizontal. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            {/* --------------------------------------------------- serviço */}
            <Card className="p-5 sm:p-6">
              <StepTitle
                number={1}
                icon={Scissors}
                label="Serviço"
                done={Boolean(service)}
              />

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

            {/* ------------------------------------------- profissional */}
            <Card className="p-5 sm:p-6">
              <StepTitle
                number={2}
                icon={User}
                label="Profissional"
                done={!catalogLoading}
              />

              {/* Rosto no lugar de um <select>: nos apps de agendamento
                  (Booksy, Fresha, Trinks) o cliente escolhe o barbeiro
                  pela foto, não pelo nome numa lista. */}
              {catalogLoading ? (
                <div className="flex gap-3">
                  {[0, 1, 2, 3].map((index) => (
                    <Skeleton key={index} className="h-28 w-24 shrink-0" />
                  ))}
                </div>
              ) : (
                <BarberPicker
                  barbers={barbers}
                  value={barberId}
                  onChange={(id) => {
                    setBarberId(id);
                    setSelected(null);
                    setWaitlisted(false);
                  }}
                />
              )}
            </Card>

            {/* ---------------------------------------------------- dia */}
            <Card className="p-5 sm:p-6">
              <StepTitle
                number={3}
                icon={CalendarDays}
                label="Dia"
                done={Boolean(date)}
              />

              <DateStrip
                value={date}
                onChange={(next) => {
                  setDate(next);
                  setSelected(null);
                  setWaitlisted(false);
                }}
              />

              <div className="mt-5">
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
            <StepTitle
              number={4}
              icon={Clock}
              label="Horário"
              done={selected !== null}
            />

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
                <SlotGrid
                  slots={slots}
                  selected={selected}
                  onSelect={setSelected}
                />
              )}
            </div>

            {/* No celular o resumo e o botão ficam na barra fixa de baixo. */}
            <div className="mt-5 hidden border-t border-line pt-5 lg:block">
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

      {/* Barra fixa no celular, como no checkout dos apps do setor: o botão
          de confirmar ficava abaixo da grade, a várias rolagens de distância. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-1/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            {service ? (
              <>
                <p className="truncate text-sm font-semibold text-ink">
                  {service.name}
                </p>
                <p className="truncate text-xs tabular text-ink-muted">
                  {selected
                    ? `${formatDateShortLabel(date)} · ${selected.time} · `
                    : `${formatDuration(service.durationMinutes)} · `}
                  <span className="font-bold text-brand-400">
                    {formatBRL(service.price)}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-muted">Escolha um serviço</p>
            )}
          </div>
          <Button
            size="lg"
            loading={booking}
            disabled={!selected || slotsLoading}
            onClick={handleBook}
            className="shrink-0"
          >
            {selected ? 'Confirmar' : 'Escolha o horário'}
          </Button>
        </div>
      </div>
    </>
  );
}

function StepTitle({
  number,
  icon: Icon,
  label,
  done = false,
}: {
  number: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  done?: boolean;
}) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 text-sm font-bold uppercase tracking-wider text-ink-muted">
      <span
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-black transition-colors',
          done
            ? 'bg-success text-surface-0'
            : 'bg-brand-500 text-surface-0',
        )}
        aria-hidden="true"
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : number}
      </span>
      <Icon className="h-4 w-4 text-brand-400" aria-hidden="true" />
      {label}
    </h2>
  );
}

/** "Seg, 22/09" — cabe na barra fixa do celular. */
function formatDateShortLabel(isoDate: string): string {
  const day = parseISODate(isoDate);
  const weekday = formatWeekdayShort(day);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${formatDayMonth(day)}`;
}

function BarberPicker({
  barbers,
  value,
  onChange,
}: {
  barbers: Barber[];
  value: string;
  onChange: (id: string) => void;
}) {
  const options = [
    { id: '', name: 'Qualquer um', photoUrl: null, hint: 'Primeiro livre' },
    ...barbers.map((barber) => ({ ...barber, hint: undefined })),
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Profissional"
      className="scroll-slim -mx-1 flex gap-3 overflow-x-auto px-1 pb-2"
    >
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id || 'any'}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors',
              active
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-line bg-surface-2 hover:border-line-strong',
            )}
          >
            <span
              className={cn(
                'relative h-14 w-14 overflow-hidden rounded-full ring-2 transition-colors',
                active ? 'ring-brand-500' : 'ring-transparent',
              )}
            >
              {option.id ? (
                <Avatar
                  name={option.name}
                  photoUrl={option.photoUrl}
                  size="fill"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-surface-3 text-brand-400">
                  <Users className="h-6 w-6" aria-hidden="true" />
                </span>
              )}
            </span>
            <span className="w-full truncate text-xs font-semibold text-ink">
              {option.id ? option.name.split(' ')[0] : option.name}
            </span>
            {option.hint && (
              <span className="-mt-1.5 text-[11px] text-ink-subtle">
                {option.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const STRIP_DAYS = 14;
const MAX_ADVANCE_DAYS = 60;

/**
 * Fita com as próximas duas semanas, no lugar do seletor de data nativo:
 * um toque por dia, com o dia da semana à vista. Datas mais distantes
 * continuam acessíveis pelo "Outra data".
 */
function DateStrip({
  value,
  onChange,
}: {
  value: string;
  onChange: (isoDate: string) => void;
}) {
  const today = todayISO();
  const days = Array.from({ length: STRIP_DAYS }, (_, index) =>
    addDaysISO(today, index),
  );
  const outsideStrip = !days.includes(value);

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Dia"
        className="scroll-slim -mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
      >
        {days.map((day, index) => {
          const active = value === day;
          const asDate = parseISODate(day);
          return (
            <button
              key={day}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={formatDateLong(asDate)}
              onClick={() => onChange(day)}
              className={cn(
                'flex w-16 shrink-0 flex-col items-center rounded-xl border py-2.5 transition-colors',
                active
                  ? 'border-brand-500 bg-brand-500 text-surface-0'
                  : 'border-line bg-surface-2 text-ink hover:border-line-strong',
              )}
            >
              <span
                className={cn(
                  'text-[11px] font-bold uppercase tracking-wider',
                  active ? 'text-surface-0/80' : 'text-ink-subtle',
                )}
              >
                {index === 0 ? 'Hoje' : formatWeekdayShort(asDate)}
              </span>
              <span className="font-display text-xl font-extrabold tabular">
                {asDate.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      <label className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-ink-muted">
        Outra data:
        <input
          type="date"
          value={outsideStrip ? value : ''}
          min={today}
          max={addDaysISO(today, MAX_ADVANCE_DAYS)}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className={cn(
            'h-9 rounded-lg border bg-surface-2 px-2 text-xs text-ink transition-colors focus:border-brand-500',
            outsideStrip ? 'border-brand-500' : 'border-line-strong',
          )}
        />
      </label>
    </div>
  );
}

/** Horários agrupados por período, como nas grades do Booksy e do Fresha. */
function SlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: Slot[];
  selected: Slot | null;
  onSelect: (slot: Slot) => void;
}) {
  const groups = new Map<string, Slot[]>();
  for (const slot of slots) {
    const period = dayPeriod(slot.time);
    groups.set(period, [...(groups.get(period) ?? []), slot]);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Horários disponíveis"
      className="scroll-slim max-h-[26rem] space-y-4 overflow-y-auto pr-1"
    >
      {[...groups].map(([period, items]) => (
        <div key={period}>
          <p className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-ink-subtle">
            {period}
            <span className="font-semibold normal-case tracking-normal">
              {items.length} {items.length === 1 ? 'horário' : 'horários'}
            </span>
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
            {items.map((slot) => {
              const isSelected = selected?.dateTime === slot.dateTime;
              return (
                <button
                  key={slot.dateTime}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelect(slot)}
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
        </div>
      ))}
    </div>
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
  const shop = useShop();

  const handleAddToCalendar = () => {
    const ics = buildCalendarEvent({
      title: `${appointment.service.name} — ${shop.name}`,
      description: `Com ${appointment.barber.name}.`,
      start: new Date(appointment.startTime),
      end: new Date(appointment.endTime),
    });
    downloadCalendarEvent(ics, `agendamento-${shop.slug}.ics`);
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
          <ButtonLink href={shop.href('/reservas')} block>
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
          href={shop.href('/reservas')}
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

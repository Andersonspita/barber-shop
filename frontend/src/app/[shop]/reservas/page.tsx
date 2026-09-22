'use client';

import React, { useCallback, useState } from 'react';
import {
  CalendarPlus,
  CalendarRange,
  Clock,
  RotateCcw,
  Scissors,
  Star,
  User,
} from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/use-session';
import { useAsyncData } from '@/lib/use-async-data';
import { CLIENT_NAV } from '@/lib/nav';
import {
  addDaysISO,
  formatBRL,
  formatDateLong,
  formatDuration,
  formatTime,
  relativeDayLabel,
  todayISO,
} from '@/lib/format';
import { AppHeader, PageHeading } from '@/components/app-header';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { RescheduleForm } from '@/components/reschedule-form';
import { useShop } from '@/lib/shop-context';

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  priceCharged: string | number;
  notes: string | null;
  service: { id: string; name: string; durationMinutes: number };
  barber: { id: string; name: string; photoUrl: string | null };
  review: { rating: number; comment: string | null } | null;
}

type Range = 'upcoming' | 'past';

const STATUS: Record<
  Appointment['status'],
  { label: string; tone: 'brand' | 'success' | 'danger' | 'neutral' }
> = {
  SCHEDULED: { label: 'Confirmado', tone: 'brand' },
  COMPLETED: { label: 'Concluído', tone: 'success' },
  CANCELLED: { label: 'Cancelado', tone: 'danger' },
  NO_SHOW: { label: 'Não compareceu', tone: 'neutral' },
};

export default function MyBookingsPage() {
  const { ready } = useSession('CLIENT');
  const toast = useToast();
  const shop = useShop();

  const [range, setRange] = useState<Range>('upcoming');

  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [cancelPending, setCancelPending] = useState(false);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [reviewing, setReviewing] = useState<Appointment | null>(null);

  // A rota agora exige recorte de data: antes devolvia o histórico inteiro,
  // do mais antigo para o mais novo.
  const fetchAppointments = useCallback(async () => {
    if (!ready) return [];

    const today = todayISO();
    const result = await api<{ items: Appointment[] }>('/appointments/me', {
      auth: true,
      query:
        range === 'upcoming'
          ? { from: today, to: addDaysISO(today, 90) }
          : { from: addDaysISO(today, -365), to: addDaysISO(today, -1) },
    });

    // No histórico, o mais recente primeiro.
    return range === 'past' ? [...result.items].reverse() : result.items;
  }, [ready, range]);

  const { data, loading, error, reload: load } = useAsyncData(fetchAppointments);
  const items = data ?? [];

  const handleCancel = async () => {
    if (!cancelling) return;
    setCancelPending(true);
    try {
      await api(`/appointments/${cancelling.id}/status`, {
        method: 'PATCH',
        auth: true,
        body: { status: 'CANCELLED' },
      });
      toast.success('Agendamento cancelado', 'O horário voltou para a agenda.');
      setCancelling(null);
      void load();
    } catch (caught) {
      toast.error(
        'Não foi possível cancelar',
        caught instanceof ApiError ? caught.message : undefined,
      );
    } finally {
      setCancelPending(false);
    }
  };

  if (!ready) return null;

  return (
    <>
      <AppHeader
        area="Portal do cliente"
        subtitle="Minhas reservas"
        items={CLIENT_NAV}
      />

      <main id="conteudo" className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <PageHeading
          title="Suas reservas"
          description="Acompanhe, remarque ou cancele seus horários."
          actions={
            <ButtonLink href={shop.href('/reservas/nova')}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Novo agendamento
            </ButtonLink>
          }
        />

        <div
          role="tablist"
          aria-label="Período"
          className="mb-6 inline-flex gap-1 rounded-xl bg-surface-2 p-1"
        >
          {(
            [
              ['upcoming', 'Próximos'],
              ['past', 'Histórico'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={range === value}
              onClick={() => setRange(value)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-bold transition-colors',
                range === value
                  ? 'bg-brand-500 text-surface-0'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {error && error.status !== 401 && (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            {error.message}
          </p>
        )}

        {loading ? (
          <SkeletonList count={3} className="h-36" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Scissors className="h-6 w-6" aria-hidden="true" />}
            title={
              range === 'upcoming'
                ? 'Nenhum horário marcado'
                : 'Nada no histórico ainda'
            }
            description={
              range === 'upcoming'
                ? 'Escolha um serviço e garanta sua cadeira em poucos toques.'
                : 'Seus atendimentos anteriores aparecem aqui.'
            }
            action={
              range === 'upcoming' ? (
                <ButtonLink href={shop.href('/reservas/nova')}>
                  Agendar agora
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-3">
            {items.map((appointment, index) => (
              <li key={appointment.id}>
                <AppointmentCard
                  appointment={appointment}
                  highlight={range === 'upcoming' && index === 0}
                  onCancel={() => setCancelling(appointment)}
                  onReschedule={() => setRescheduling(appointment)}
                  onReview={() => setReviewing(appointment)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancelar este horário?"
        description={
          cancelling
            ? `${cancelling.service.name} com ${cancelling.barber.name}, ${formatDateLong(cancelling.startTime)} às ${formatTime(cancelling.startTime)}. O horário volta para a agenda e outra pessoa pode reservá-lo.`
            : ''
        }
        confirmLabel="Sim, cancelar"
        cancelLabel="Manter horário"
        loading={cancelPending}
        onConfirm={handleCancel}
        onCancel={() => setCancelling(null)}
      />

      {rescheduling && (
        <RescheduleForm
          appointment={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null);
            void load();
          }}
        />
      )}

      {reviewing && (
        <ReviewDialog
          appointment={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null);
            void load();
          }}
        />
      )}
    </>
  );
}

function AppointmentCard({
  appointment,
  highlight = false,
  onCancel,
  onReschedule,
  onReview,
}: {
  appointment: Appointment;
  /** O próximo horário ganha destaque, como o cartão "Próximo" dos apps. */
  highlight?: boolean;
  onCancel: () => void;
  onReschedule: () => void;
  onReview: () => void;
}) {
  const status = STATUS[appointment.status];
  const isScheduled = appointment.status === 'SCHEDULED';
  const canReview = appointment.status === 'COMPLETED';
  const shop = useShop();
  // Refazer o último corte em um toque: é o atalho de recompra que Booksy e
  // Fresha põem em todo item do histórico.
  const rebookHref = shop.href(
    `/reservas/nova?serviceId=${appointment.service.id}&barberId=${appointment.barber.id}`,
  );

  return (
    <Card
      className={cn(
        'relative overflow-hidden p-5',
        !isScheduled && 'opacity-80',
        highlight && 'border-brand-500/50 bg-brand-500/[0.04]',
      )}
    >
      {highlight && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1 bg-brand-500"
        />
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {highlight && (
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-400">
              Seu próximo horário
            </p>
          )}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {isScheduled && (
              <Badge tone="neutral">
                {relativeDayLabel(appointment.startTime)}
              </Badge>
            )}
            <span className="text-xs font-semibold tabular text-ink-muted">
              {formatDateLong(appointment.startTime)} ·{' '}
              {formatTime(appointment.startTime)}
            </span>
          </div>

          <h2 className="font-display text-lg font-bold text-ink">
            {appointment.service.name}
          </h2>

          {/* O cliente não via com quem ia cortar: a tela antiga mostrava
              serviço, data e preço, e nunca o profissional. */}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" aria-hidden="true" />
              {appointment.barber.name}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDuration(appointment.service.durationMinutes)}
            </span>
          </p>

          {appointment.notes && (
            <p className="mt-2 text-xs italic text-ink-subtle">
              “{appointment.notes}”
            </p>
          )}

          {appointment.review && (
            <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-400">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              Você avaliou com {appointment.review.rating} de 5
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <p className="font-display text-xl font-extrabold tabular text-ink">
            {formatBRL(appointment.priceCharged)}
          </p>

          <div className="flex flex-wrap gap-2">
            {isScheduled && (
              <>
                <Button variant="secondary" size="sm" onClick={onReschedule}>
                  <CalendarRange className="h-4 w-4" aria-hidden="true" />
                  Remarcar
                </Button>
                <Button variant="danger" size="sm" onClick={onCancel}>
                  Cancelar
                </Button>
              </>
            )}
            {canReview && !appointment.review && (
              <Button variant="secondary" size="sm" onClick={onReview}>
                <Star className="h-4 w-4" aria-hidden="true" />
                Avaliar
              </Button>
            )}
            {!isScheduled && (
              <ButtonLink href={rebookHref} variant="secondary" size="sm">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Agendar de novo
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ReviewDialog({
  appointment,
  onClose,
  onDone,
}: {
  appointment: Appointment;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api(`/appointments/${appointment.id}/review`, {
        method: 'POST',
        auth: true,
        body: { rating, comment: comment.trim() || undefined },
      });
      toast.success('Obrigado pela avaliação!');
      onDone();
    } catch (caught) {
      toast.error(
        'Não foi possível enviar',
        caught instanceof ApiError ? caught.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Como foi o atendimento?"
      description={`${appointment.service.name} com ${appointment.barber.name}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Agora não
          </Button>
          <Button onClick={submit} loading={saving}>
            Enviar avaliação
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Sua nota
        </legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} de 5`}
              aria-pressed={rating === value}
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl border transition-colors',
                value <= rating
                  ? 'border-brand-500 bg-brand-500/12 text-brand-400'
                  : 'border-line bg-surface-2 text-ink-subtle hover:border-line-strong',
              )}
            >
              <Star
                className={cn('h-5 w-5', value <= rating && 'fill-current')}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Comentário (opcional)
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="O que achou?"
          className="min-h-24 w-full resize-y rounded-xl border border-line-strong bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500"
        />
      </label>
    </Modal>
  );
}

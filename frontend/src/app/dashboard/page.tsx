'use client';

import React, { useCallback, useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  UserX,
  X,
} from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/use-session';
import { useAsyncData } from '@/lib/use-async-data';
import { staffNav } from '@/lib/nav';
import {
  addDaysISO,
  formatBRL,
  formatDateLong,
  formatDuration,
  formatPhone,
  formatTime,
  todayISO,
} from '@/lib/format';
import { AppHeader, PageHeading } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, StatCard } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { RescheduleForm } from '@/components/reschedule-form';
import { BlockScheduleDialog } from '@/components/block-schedule-dialog';
import { WalkInDialog } from '@/components/walk-in-dialog';
import { cn } from '@/lib/cn';

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  priceCharged: string | number;
  notes: string | null;
  client: { id: string; name: string; email: string; phoneNumber: string | null };
  service: { id: string; name: string; durationMinutes: number };
  barber: { id: string; name: string; photoUrl: string | null };
}

interface Metrics {
  totalRevenue: number;
  completedCount: number;
  pendingCount: number;
  noShowCount: number;
}

const STATUS: Record<
  Appointment['status'],
  { label: string; tone: 'brand' | 'success' | 'danger' | 'neutral' }
> = {
  SCHEDULED: { label: 'Confirmado', tone: 'brand' },
  COMPLETED: { label: 'Concluído', tone: 'success' },
  CANCELLED: { label: 'Cancelado', tone: 'danger' },
  NO_SHOW: { label: 'Faltou', tone: 'neutral' },
};

export default function DashboardPage() {
  const { user, ready } = useSession('STAFF');
  const toast = useToast();

  const [date, setDate] = useState(todayISO());

  const [blockOpen, setBlockOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [confirming, setConfirming] = useState<{
    appointment: Appointment;
    status: 'CANCELLED' | 'NO_SHOW';
  } | null>(null);
  const [pending, setPending] = useState(false);

  // A agenda passa a ser sempre de um dia. Antes a rota devolvia todo o
  // histórico do barbeiro em ordem crescente, o que empurrava os
  // atendimentos de hoje para o fim da lista.
  const fetchAgenda = useCallback(async () => {
    if (!ready) return null;

    const [list, todayMetrics] = await Promise.all([
      api<{ items: Appointment[] }>('/appointments/me', {
        auth: true,
        query: { from: date, to: date, pageSize: 100 },
      }),
      api<Metrics>('/appointments/metrics/today', { auth: true }),
    ]);

    return { appointments: list.items, metrics: todayMetrics };
  }, [ready, date]);

  const { data, loading, error, reload: load } = useAsyncData(fetchAgenda);
  const appointments = data?.appointments ?? [];
  const metrics = data?.metrics ?? null;

  const updateStatus = async (
    appointment: Appointment,
    status: Appointment['status'],
  ) => {
    setPending(true);
    try {
      await api(`/appointments/${appointment.id}/status`, {
        method: 'PATCH',
        auth: true,
        body: { status },
      });
      toast.success(
        status === 'COMPLETED'
          ? 'Atendimento concluído'
          : status === 'NO_SHOW'
            ? 'Falta registrada'
            : 'Agendamento cancelado',
      );
      setConfirming(null);
      void load();
    } catch (caught) {
      toast.error(
        'Não foi possível atualizar',
        caught instanceof ApiError ? caught.message : undefined,
      );
    } finally {
      setPending(false);
    }
  };

  if (!ready || !user) return null;

  const isToday = date === todayISO();

  return (
    <>
      <AppHeader
        area="Painel"
        subtitle={user.name}
        items={staffNav(user.isAdmin)}
        loginPath="/login?area=profissional"
      />

      <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <PageHeading
          title="Sua agenda"
          description="Atendimentos do dia, com o que fazer em cada um."
          actions={
            <>
              <Button variant="secondary" onClick={() => setBlockOpen(true)}>
                <Lock className="h-4 w-4" aria-hidden="true" />
                Bloquear horário
              </Button>
              <Button onClick={() => setWalkInOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Encaixe
              </Button>
            </>
          }
        />

        {error && error.status !== 401 && (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            {error.message}
          </p>
        )}

        {/* ----------------------------------------------------- métricas */}
        <section
          aria-label="Resumo de hoje"
          className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {loading && !metrics ? (
            Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28" />
            ))
          ) : (
            <>
              <StatCard
                label="Faturamento hoje"
                value={formatBRL(metrics?.totalRevenue ?? 0)}
                tone="brand"
              />
              <StatCard
                label="Concluídos"
                value={metrics?.completedCount ?? 0}
                tone="success"
              />
              <StatCard label="Pendentes" value={metrics?.pendingCount ?? 0} />
              <StatCard
                label="Faltas"
                value={metrics?.noShowCount ?? 0}
                tone={metrics?.noShowCount ? 'danger' : 'default'}
              />
            </>
          )}
        </section>

        {/* ------------------------------------------------ seletor de dia */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl border border-line bg-surface-1">
            <button
              type="button"
              onClick={() => setDate(addDaysISO(date, -1))}
              aria-label="Dia anterior"
              className="rounded-l-xl p-3 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Data da agenda"
              className="border-x border-line bg-transparent px-3 py-2.5 text-sm font-semibold text-ink"
            />
            <button
              type="button"
              onClick={() => setDate(addDaysISO(date, 1))}
              aria-label="Próximo dia"
              className="rounded-r-xl p-3 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {!isToday && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDate(todayISO())}
            >
              Voltar para hoje
            </Button>
          )}

          <p className="ml-auto text-sm font-semibold capitalize text-ink-muted">
            {formatDateLong(date)}
          </p>
        </div>

        {/* ------------------------------------------------------- agenda */}
        {loading ? (
          <SkeletonList count={3} className="h-32" />
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
            title="Agenda livre neste dia"
            description="Quando alguém marcar, o atendimento aparece aqui — e você também pode registrar um encaixe."
            action={
              <Button onClick={() => setWalkInOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Registrar encaixe
              </Button>
            }
          />
        ) : (
          <ol className="space-y-3">
            {appointments.map((appointment) => (
              <li key={appointment.id}>
                <AppointmentRow
                  appointment={appointment}
                  pending={pending}
                  onComplete={() => updateStatus(appointment, 'COMPLETED')}
                  onCancel={() =>
                    setConfirming({ appointment, status: 'CANCELLED' })
                  }
                  onNoShow={() =>
                    setConfirming({ appointment, status: 'NO_SHOW' })
                  }
                  onReschedule={() => setRescheduling(appointment)}
                />
              </li>
            ))}
          </ol>
        )}
      </main>

      <BlockScheduleDialog
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        onDone={() => {
          setBlockOpen(false);
          void load();
        }}
      />

      <WalkInDialog
        open={walkInOpen}
        date={date}
        onClose={() => setWalkInOpen(false)}
        onDone={() => {
          setWalkInOpen(false);
          void load();
        }}
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

      <ConfirmDialog
        open={confirming !== null}
        title={
          confirming?.status === 'NO_SHOW'
            ? 'Registrar falta?'
            : 'Cancelar atendimento?'
        }
        description={
          confirming
            ? confirming.status === 'NO_SHOW'
              ? `${confirming.appointment.client.name} não compareceu ao horário de ${formatTime(confirming.appointment.startTime)}. A falta fica registrada na ficha do cliente.`
              : `O horário de ${formatTime(confirming.appointment.startTime)} com ${confirming.appointment.client.name} volta para a agenda e o cliente é avisado.`
            : ''
        }
        confirmLabel={
          confirming?.status === 'NO_SHOW' ? 'Registrar falta' : 'Cancelar'
        }
        cancelLabel="Voltar"
        loading={pending}
        onConfirm={() =>
          confirming && updateStatus(confirming.appointment, confirming.status)
        }
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}

function AppointmentRow({
  appointment,
  pending,
  onComplete,
  onCancel,
  onNoShow,
  onReschedule,
}: {
  appointment: Appointment;
  pending: boolean;
  onComplete: () => void;
  onCancel: () => void;
  onNoShow: () => void;
  onReschedule: () => void;
}) {
  const status = STATUS[appointment.status];
  const isScheduled = appointment.status === 'SCHEDULED';

  return (
    <Card className={cn('p-5', !isScheduled && 'opacity-75')}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {/* Hora em destaque: é por ela que o barbeiro procura na lista. */}
          <div className="shrink-0 text-center">
            <p className="font-display text-xl font-extrabold tabular text-brand-400">
              {formatTime(appointment.startTime)}
            </p>
            <p className="text-xs tabular text-ink-subtle">
              {formatDuration(appointment.service.durationMinutes)}
            </p>
          </div>

          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-bold text-ink">
                {appointment.client.name}
              </h2>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>

            <p className="text-sm text-ink-muted">
              {appointment.service.name} ·{' '}
              <span className="tabular">
                {formatBRL(appointment.priceCharged)}
              </span>
            </p>

            {appointment.client.phoneNumber && (
              <a
                href={`https://wa.me/${appointment.client.phoneNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs font-semibold tabular text-ink-subtle transition-colors hover:text-brand-400"
              >
                {formatPhone(appointment.client.phoneNumber)}
              </a>
            )}

            {appointment.notes && (
              <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs italic text-ink-muted">
                “{appointment.notes}”
              </p>
            )}
          </div>
        </div>

        {isScheduled && (
          <div className="flex flex-wrap gap-2 lg:shrink-0">
            <Button
              variant="success"
              size="sm"
              disabled={pending}
              onClick={onComplete}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Concluir
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={onReschedule}
            >
              <CalendarRange className="h-4 w-4" aria-hidden="true" />
              Remarcar
            </Button>
            {/* NO_SHOW existia no schema desde o início e não tinha como ser
                registrado por nenhuma tela. */}
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={onNoShow}
            >
              <UserX className="h-4 w-4" aria-hidden="true" />
              Faltou
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={onCancel}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

'use client';

import { useCallback, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useAsyncData } from '@/lib/use-async-data';
import { addDaysISO, formatDateLong, formatTime, todayISO } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

interface Slot {
  time: string;
  dateTime: string;
  barberIds: string[];
}

interface Appointment {
  id: string;
  startTime: string;
  service: { id: string; name: string };
  barber: { id: string; name: string };
}

/**
 * Remarcação. Antes o caminho era cancelar e agendar de novo: o horário
 * antigo voltava ao mercado na hora e, se o novo não estivesse livre, o
 * cliente terminava sem nenhum dos dois.
 */
export function RescheduleForm({
  appointment,
  onClose,
  onDone,
  keepBarber = true,
}: {
  appointment: Appointment;
  onClose: () => void;
  onDone: () => void;
  keepBarber?: boolean;
}) {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [selected, setSelected] = useState<Slot | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchSlots = useCallback(
    () =>
      api<Slot[]>('/appointments/availability', {
        query: {
          date,
          serviceId: appointment.service.id,
          barberId: keepBarber ? appointment.barber.id : undefined,
        },
      }),
    [date, appointment.service.id, appointment.barber.id, keepBarber],
  );

  const { data, loading } = useAsyncData(fetchSlots);
  const slots = data ?? [];

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api(`/appointments/${appointment.id}/reschedule`, {
        method: 'PATCH',
        auth: true,
        body: { startTime: selected.dateTime },
      });
      toast.success(
        'Agendamento remarcado',
        `Agora é ${formatDateLong(selected.dateTime)} às ${selected.time}.`,
      );
      onDone();
    } catch (caught) {
      toast.error(
        'Não foi possível remarcar',
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
      title="Remarcar horário"
      description={`${appointment.service.name} com ${appointment.barber.name}, hoje marcado para ${formatDateLong(appointment.startTime)} às ${formatTime(appointment.startTime)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Voltar
          </Button>
          <Button onClick={submit} loading={saving} disabled={!selected}>
            {selected ? `Mover para ${selected.time}` : 'Escolha um horário'}
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Nova data
        </span>
        <input
          type="date"
          value={date}
          min={todayISO()}
          max={addDaysISO(todayISO(), 60)}
          onChange={(e) => {
            setDate(e.target.value);
            setSelected(null);
          }}
          className="h-12 w-full rounded-xl border border-line-strong bg-surface-2 px-4 text-sm text-ink focus:border-brand-500"
        />
      </label>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Horários livres
        </p>

        {loading ? (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
            Nenhum horário livre neste dia. Tente outra data.
          </p>
        ) : (
          <div
            role="radiogroup"
            aria-label="Horários livres"
            className="scroll-slim grid max-h-56 grid-cols-4 gap-2 overflow-y-auto pr-1"
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
                      : 'border border-line bg-surface-2 text-ink hover:border-brand-500/60',
                  )}
                >
                  {slot.time}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

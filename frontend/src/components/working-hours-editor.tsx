'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { labelToMinutes, minutesToLabel } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

interface Shift {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

const WEEKDAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

const DEFAULT_SHIFT = { startMinute: 9 * 60, endMinute: 18 * 60 };

/**
 * Jornada semanal do profissional.
 *
 * O expediente era uma constante no código — 09h às 18h, igual para todos os
 * barbeiros e todos os dias, domingo incluído. Quem folgava numa quarta
 * precisava bloquear a agenda manualmente, semana após semana.
 *
 * Vários turnos no mesmo dia representam a pausa do almoço.
 */
export function WorkingHoursEditor({
  barber,
  onClose,
}: {
  barber: { id: string; name: string };
  onClose: () => void;
}) {
  const toast = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Shift[]>(`/admin/barbers/${barber.id}/working-hours`, { auth: true })
      .then(setShifts)
      .catch(() => setShifts([]))
      .finally(() => setLoading(false));
  }, [barber.id]);

  const addShift = (weekday: number) => {
    setShifts((current) => [...current, { weekday, ...DEFAULT_SHIFT }]);
  };

  const removeShift = (index: number) => {
    setShifts((current) => current.filter((_, i) => i !== index));
  };

  const updateShift = (index: number, patch: Partial<Shift>) => {
    setShifts((current) =>
      current.map((shift, i) => (i === index ? { ...shift, ...patch } : shift)),
    );
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api(`/admin/barbers/${barber.id}/working-hours`, {
        method: 'PUT',
        auth: true,
        body: { shifts },
      });
      toast.success('Jornada salva', `A agenda de ${barber.name} foi atualizada.`);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Não foi possível salvar a jornada.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Jornada de ${barber.name}`}
      description="Dias e horários em que este profissional atende. Deixe um dia vazio para folga."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving}>
            Salvar jornada
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {WEEKDAYS.map((label, weekday) => {
            const dayShifts = shifts
              .map((shift, index) => ({ shift, index }))
              .filter(({ shift }) => shift.weekday === weekday);

            return (
              <div
                key={weekday}
                className="rounded-xl border border-line bg-surface-2 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-ink">{label}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addShift(weekday)}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Turno
                  </Button>
                </div>

                {dayShifts.length === 0 ? (
                  <p className="text-xs text-ink-subtle">Folga</p>
                ) : (
                  <ul className="space-y-2">
                    {dayShifts.map(({ shift, index }) => (
                      <li key={index} className="flex items-center gap-2">
                        <label className="sr-only" htmlFor={`start-${index}`}>
                          Início do turno em {label}
                        </label>
                        <input
                          id={`start-${index}`}
                          type="time"
                          step={300}
                          value={minutesToLabel(shift.startMinute)}
                          onChange={(e) =>
                            updateShift(index, {
                              startMinute: labelToMinutes(e.target.value),
                            })
                          }
                          className="h-10 rounded-lg border border-line-strong bg-surface-1 px-3 text-sm tabular text-ink focus:border-brand-500"
                        />
                        <span className="text-ink-subtle" aria-hidden="true">
                          até
                        </span>
                        <label className="sr-only" htmlFor={`end-${index}`}>
                          Fim do turno em {label}
                        </label>
                        <input
                          id={`end-${index}`}
                          type="time"
                          step={300}
                          value={minutesToLabel(shift.endMinute)}
                          onChange={(e) =>
                            updateShift(index, {
                              endMinute: labelToMinutes(e.target.value),
                            })
                          }
                          className="h-10 rounded-lg border border-line-strong bg-surface-1 px-3 text-sm tabular text-ink focus:border-brand-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeShift(index)}
                          aria-label={`Remover turno de ${label}`}
                          className="ml-auto rounded-lg p-2 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

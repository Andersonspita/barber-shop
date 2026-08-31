'use client';

import React, { useCallback, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useAsyncData } from '@/lib/use-async-data';
import { formatBRL, formatDateLong } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

interface Service {
  id: string;
  name: string;
  price: string | number;
  durationMinutes: number;
}

interface Slot {
  time: string;
  dateTime: string;
}

/**
 * Encaixe de balcão.
 *
 * Só existia um caminho para criar agendamento: o cliente logado, marcando
 * para si. Na prática boa parte do movimento de uma barbearia entra pela
 * porta ou pelo telefone — e esses atendimentos ficavam fora do sistema,
 * o que também tirava o relatório financeiro do prumo.
 */
export function WalkInDialog({
  open,
  date,
  onClose,
  onDone,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();

  const [serviceId, setServiceId] = useState('');
  const [startTime, setStartTime] = useState('');

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [force, setForce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchServices = useCallback(
    () => (open ? api<Service[]>('/services') : Promise.resolve([])),
    [open],
  );
  const { data: serviceList } = useAsyncData(fetchServices);
  const services = serviceList ?? [];

  const effectiveServiceId = serviceId || services[0]?.id || '';

  const fetchSlots = useCallback(
    () =>
      open && effectiveServiceId
        ? api<Slot[]>('/appointments/availability', {
            query: { date, serviceId: effectiveServiceId },
          })
        : Promise.resolve([]),
    [open, effectiveServiceId, date],
  );
  const { data: slotList, loading: slotsLoading } = useAsyncData(fetchSlots);
  const slots = slotList ?? [];

  // Sem escolha explícita, vale o primeiro horário livre do dia.
  const effectiveStartTime = startTime || slots[0]?.dateTime || '';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!effectiveStartTime) {
      setError('Escolha um horário para o atendimento.');
      return;
    }

    setSaving(true);
    try {
      await api('/appointments/walk-in', {
        method: 'POST',
        auth: true,
        body: {
          serviceId: effectiveServiceId,
          startTime: effectiveStartTime,
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim() || undefined,
          notes: notes.trim() || undefined,
          force,
        },
      });
      toast.success('Encaixe registrado', `${clientName} está na sua agenda.`);
      setClientName('');
      setClientPhone('');
      setNotes('');
      setForce(false);
      onDone();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Não foi possível registrar o encaixe.',
      );
    } finally {
      setSaving(false);
    }
  };

  const service = services.find((s) => s.id === effectiveServiceId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar encaixe"
      description={`Atendimento de balcão em ${formatDateLong(date)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="walk-in-form" loading={saving}>
            Registrar
          </Button>
        </>
      }
    >
      <form id="walk-in-form" onSubmit={submit} className="space-y-4">
        <Field label="Nome do cliente" hint="Criamos o cadastro se ainda não existir.">
          {(props) => (
            <Input
              {...props}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
              placeholder="Ex.: Pedro Alves"
            />
          )}
        </Field>

        <Field
          label="Celular"
          hint="Opcional, mas é por ele que a confirmação chega."
        >
          {(props) => (
            <Input
              {...props}
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          )}
        </Field>

        <Field label="Serviço">
          {(props) => (
            <Select
              {...props}
              value={effectiveServiceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setStartTime('');
              }}
              required
            >
              {services.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {formatBRL(item.price)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Horário"
          hint={
            slotsLoading
              ? 'Consultando a agenda…'
              : slots.length === 0
                ? 'Sem horário livre neste dia — marque "fora da grade" abaixo.'
                : undefined
          }
        >
          {(props) => (
            <Select
              {...props}
              value={effectiveStartTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={slots.length === 0}
            >
              {slots.map((slot) => (
                <option key={slot.dateTime} value={slot.dateTime}>
                  {slot.time}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Observação" hint="Opcional.">
          {(props) => (
            <Input
              {...props}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Ex.: cliente do Pedro"
            />
          )}
        </Field>

        <Checkbox
          label="Encaixe fora da grade"
          description="Ignora antecedência mínima e horizonte de agendamento. O conflito com outro atendimento continua sendo checado."
          checked={force}
          onChange={(e) => setForce(e.target.checked)}
        />

        {service && (
          <p className="text-xs text-ink-subtle">
            Valor: <span className="tabular">{formatBRL(service.price)}</span> ·
            Duração: {service.durationMinutes} min
          </p>
        )}

        {error && (
          <p
            role="alert"
            className={cn(
              'rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger',
            )}
          >
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

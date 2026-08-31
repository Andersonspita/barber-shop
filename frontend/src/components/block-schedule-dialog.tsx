'use client';

import React, { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';

/**
 * Bloqueio pontual da agenda — almoço, folga, compromisso. A jornada
 * recorrente fica em Equipe; aqui é a exceção do dia.
 */
export function BlockScheduleDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (new Date(start) >= new Date(end)) {
      setError('O término precisa ser depois do início.');
      return;
    }

    setSaving(true);
    try {
      await api('/schedule-blocks', {
        method: 'POST',
        auth: true,
        body: {
          startTime: new Date(start).toISOString(),
          endTime: new Date(end).toISOString(),
          reason: reason.trim() || undefined,
        },
      });
      toast.success('Horário bloqueado', 'Ninguém consegue marcar nesse período.');
      setStart('');
      setEnd('');
      setReason('');
      onDone();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Não foi possível bloquear o horário.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bloquear horário"
      description="Defina um período em que você não estará disponível."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="block-form" loading={saving}>
            Bloquear
          </Button>
        </>
      }
    >
      <form id="block-form" onSubmit={submit} className="space-y-4">
        <Field label="Início">
          {(props) => (
            <Input
              {...props}
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          )}
        </Field>

        <Field label="Término">
          {(props) => (
            <Input
              {...props}
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          )}
        </Field>

        <Field label="Motivo" hint="Opcional. Só você vê.">
          {(props) => (
            <Input
              {...props}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="Ex.: almoço"
            />
          )}
        </Field>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

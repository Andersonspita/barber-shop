'use client';

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { BillingSummary } from '@/lib/billing';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

/** Abre a página da fatura no Asaas (Pix, boleto ou cartão). */
export function PayOnlineLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-surface-0 transition-colors hover:bg-brand-400"
    >
      Pagar online
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

/**
 * Liga o pagamento online: o CPF/CNPJ vai para o Asaas (não fica guardado
 * aqui) e as faturas passam a sair com link de Pix, boleto ou cartão.
 */
export function EnableOnlinePaymentForm({
  onEnabled,
}: {
  onEnabled: (summary: BillingSummary) => void;
}) {
  const toast = useToast();
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const summary = await api<BillingSummary>('/admin/billing/online-payment', {
        method: 'POST',
        auth: true,
        body: { cpfCnpj },
      });
      onEnabled(summary);
      toast.success(
        'Pagamento online ativado',
        'A mensalidade em aberto já pode ser paga por Pix, boleto ou cartão.',
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Não foi possível ativar o pagamento online.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1">
        <Field
          label="CPF ou CNPJ de quem paga"
          hint="Usado só para emitir a cobrança no Asaas."
          error={error ?? undefined}
        >
          {(props) => (
            <Input
              {...props}
              inputMode="numeric"
              autoComplete="off"
              maxLength={18}
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              placeholder="000.000.000-00"
              required
            />
          )}
        </Field>
      </div>
      <Button type="submit" loading={saving} className="mb-[22px]">
        Pagar online
      </Button>
    </form>
  );
}

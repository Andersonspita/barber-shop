'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, Search, UserRound, Users } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/use-session';
import { useAsyncData } from '@/lib/use-async-data';
import { ADMIN_NAV } from '@/lib/nav';
import { formatBRL, formatDate, formatPhone } from '@/lib/format';
import { AppHeader, PageHeading } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

interface Client {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  birthDate: string | null;
  isActive: boolean;
  createdAt: string;
}

interface History {
  client: Client;
  metrics: {
    totalSpent: number;
    completedCount: number;
    cancelledCount: number;
    noShowCount: number;
    totalAppointments: number;
    ticketAverage: number;
  };
  history: Array<{
    id: string;
    date: string;
    service: string;
    price: number;
    barber: string;
    status: string;
    rating: number | null;
  }>;
}

export default function ClientsPage() {
  const { user, ready } = useSession('ADMIN');
  const toast = useToast();

  const [search, setSearch] = useState('');
  // Espera o usuário parar de digitar antes de consultar o servidor.
  const debouncedSearch = useDebounced(search, 300);

  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<History | null>(null);

  const fetchClients = useCallback(
    () =>
      ready
        ? api<{ items: Client[]; total: number }>('/admin/clients', {
            auth: true,
            query: { search: debouncedSearch || undefined, pageSize: 100 },
          })
        : Promise.resolve({ items: [], total: 0 }),
    [ready, debouncedSearch],
  );

  const { data, loading, reload: load } = useAsyncData(fetchClients);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const openHistory = async (client: Client) => {
    try {
      const result = await api<History>(`/admin/clients/${client.id}/history`, {
        auth: true,
      });
      setViewing(result);
    } catch (caught) {
      toast.error(
        'Não foi possível abrir a ficha',
        caught instanceof ApiError ? caught.message : undefined,
      );
    }
  };

  const resetPassword = async (client: Client) => {
    try {
      const result = await api<{ temporaryPassword: string }>(
        `/admin/clients/${client.id}/reset-password`,
        { method: 'POST', auth: true },
      );
      toast.success(
        'Senha temporária gerada',
        `Passe para ${client.name}: ${result.temporaryPassword} — será trocada no primeiro acesso.`,
      );
    } catch (caught) {
      toast.error(
        'Não foi possível gerar a senha',
        caught instanceof ApiError ? caught.message : undefined,
      );
    }
  };

  if (!ready || !user) return null;

  return (
    <>
      <AppHeader
        area="Painel"
        subtitle="Clientes"
        items={ADMIN_NAV}
        loginPath="/login?area=profissional"
      />

      <main id="conteudo" className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <PageHeading
          title="Clientes"
          description={`${total} cadastrado${total === 1 ? '' : 's'} na barbearia.`}
          actions={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo cliente
            </Button>
          }
        />

        <div className="relative mb-5">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar cliente"
            placeholder="Buscar por nome, e-mail ou telefone"
            className="h-12 w-full rounded-xl border border-line-strong bg-surface-2 pl-11 pr-4 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500"
          />
        </div>

        {loading ? (
          <SkeletonList count={5} className="h-20" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" aria-hidden="true" />}
            title={search ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}
            description={
              search
                ? 'Tente outro termo de busca.'
                : 'Cadastre o primeiro cliente ou espere o primeiro agendamento pelo site.'
            }
          />
        ) : (
          <ul className="space-y-2">
            {items.map((client) => (
              <li key={client.id}>
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => openHistory(client)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-subtle">
                      <UserRound className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-ink">
                          {client.name}
                        </span>
                        {!client.isActive && (
                          <Badge tone="neutral">Inativo</Badge>
                        )}
                      </span>
                      <span className="block truncate text-xs text-ink-subtle">
                        {client.phoneNumber
                          ? formatPhone(client.phoneNumber)
                          : 'Sem telefone'}{' '}
                        · desde {formatDate(client.createdAt)}
                      </span>
                    </span>
                  </button>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resetPassword(client)}
                      aria-label={`Gerar senha temporária para ${client.name}`}
                    >
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditing(client)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Editar
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>

      {(creating || editing) && (
        <ClientDialog
          client={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={() => {
            setCreating(false);
            setEditing(null);
            void load();
          }}
        />
      )}

      {viewing && (
        <HistoryDialog history={viewing} onClose={() => setViewing(null)} />
      )}
    </>
  );
}

function ClientDialog({
  client,
  onClose,
  onDone,
}: {
  client: Client | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(client?.name ?? '');
  const [email, setEmail] = useState(
    client?.email.endsWith('@local.invalid') ? '' : (client?.email ?? ''),
  );
  const [phone, setPhone] = useState(client?.phoneNumber ?? '');
  const [birthDate, setBirthDate] = useState(
    client?.birthDate ? client.birthDate.slice(0, 10) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const body = {
        name,
        email: email || undefined,
        phoneNumber: phone || undefined,
        birthDate: birthDate || undefined,
      };

      if (client) {
        await api(`/admin/clients/${client.id}`, {
          method: 'PUT',
          auth: true,
          body,
        });
        toast.success('Cliente atualizado');
      } else {
        const created = await api<{ temporaryPassword: string }>(
          '/admin/clients',
          { method: 'POST', auth: true, body },
        );
        toast.success(
          'Cliente cadastrado',
          `Senha temporária: ${created.temporaryPassword}`,
        );
      }
      onDone();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Não foi possível salvar.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={client ? 'Editar cliente' : 'Novo cliente'}
      description={
        client
          ? undefined
          : 'A senha é sorteada e trocada no primeiro acesso do cliente.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="client-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={submit} className="space-y-4">
        <Field label="Nome">
          {(props) => (
            <Input
              {...props}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
        </Field>

        <Field
          label="E-mail"
          hint="Opcional — quem chega pelo balcão nem sempre tem um."
        >
          {(props) => (
            <Input
              {...props}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
            />
          )}
        </Field>

        <Field label="Celular">
          {(props) => (
            <Input
              {...props}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          )}
        </Field>

        <Field
          label="Data de nascimento"
          hint="Entra na campanha de aniversário."
          error={error}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}

function HistoryDialog({
  history,
  onClose,
}: {
  history: History;
  onClose: () => void;
}) {
  const { client, metrics } = history;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={client.name}
      description={`${client.phoneNumber ? formatPhone(client.phoneNumber) : 'Sem telefone'} · cliente desde ${formatDate(client.createdAt)}`}
    >
      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Já gastou" value={formatBRL(metrics.totalSpent)} />
        <Stat label="Ticket médio" value={formatBRL(metrics.ticketAverage)} />
        <Stat label="Atendimentos" value={String(metrics.completedCount)} />
        <Stat
          label="Faltas"
          value={String(metrics.noShowCount)}
          tone={metrics.noShowCount > 0 ? 'danger' : undefined}
        />
      </dl>

      {history.history.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
          Este cliente ainda não tem atendimentos registrados.
        </p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <ul className="divide-y divide-line">
            {history.history.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {entry.service}
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {formatDate(entry.date)} · {entry.barber}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular text-ink">
                    {formatBRL(entry.price)}
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {STATUS_LABEL[entry.status] ?? entry.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Faltou',
};

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger';
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
        {label}
      </dt>
      <dd
        className={`mt-1 font-display text-lg font-extrabold tabular ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}
      >
        {value}
      </dd>
    </div>
  );
}

/** Atrasa o valor até o usuário parar de digitar. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

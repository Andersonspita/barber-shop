'use client';

import React, { useCallback, useState } from 'react';
import { CalendarClock, KeyRound, Pencil, Plus, Power, Scissors } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/use-session';
import { useAsyncData } from '@/lib/use-async-data';
import { ADMIN_NAV } from '@/lib/nav';
import { AppHeader, PageHeading } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/field';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { WorkingHoursEditor } from '@/components/working-hours-editor';

interface Barber {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  isAdmin: boolean;
  isActive: boolean;
  photoUrl: string | null;
  bio: string | null;
  commissionRate: string | number | null;
  _count?: { barberAppointments: number };
}

export default function TeamPage() {
  const { user, ready } = useSession('ADMIN');
  const toast = useToast();

  const [editing, setEditing] = useState<Barber | null>(null);
  const [creating, setCreating] = useState(false);
  const [hoursFor, setHoursFor] = useState<Barber | null>(null);
  const [deactivating, setDeactivating] = useState<Barber | null>(null);
  const [pending, setPending] = useState(false);

  const fetchBarbers = useCallback(
    () => (ready ? api<Barber[]>('/admin/barbers', { auth: true }) : Promise.resolve([])),
    [ready],
  );

  const { data, loading, reload: load } = useAsyncData(fetchBarbers);
  const barbers = data ?? [];

  const toggleActive = async (barber: Barber) => {
    setPending(true);
    try {
      if (barber.isActive) {
        const result = await api<{ warning: string | null }>(
          `/admin/barbers/${barber.id}`,
          { method: 'DELETE', auth: true },
        );
        // Desativa em vez de excluir: o histórico sustenta o financeiro.
        toast.success(
          'Profissional desativado',
          result.warning ?? 'Ele some da agenda e do site.',
        );
      } else {
        await api(`/admin/barbers/${barber.id}/reactivate`, {
          method: 'PATCH',
          auth: true,
        });
        toast.success('Profissional reativado');
      }
      setDeactivating(null);
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

  const resetPassword = async (barber: Barber) => {
    try {
      const result = await api<{ temporaryPassword: string }>(
        `/admin/barbers/${barber.id}/reset-password`,
        { method: 'POST', auth: true },
      );
      toast.success(
        'Senha temporária gerada',
        `Passe para ${barber.name}: ${result.temporaryPassword} — será trocada no primeiro acesso.`,
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
        subtitle="Equipe"
        items={ADMIN_NAV}
        loginPath="/login?area=profissional"
      />

      <main id="conteudo" className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <PageHeading
          title="Equipe"
          description="Quem atende, a jornada de cada um e a comissão."
          actions={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo profissional
            </Button>
          }
        />

        {loading ? (
          <SkeletonList count={3} className="h-24" />
        ) : barbers.length === 0 ? (
          <EmptyState
            icon={<Scissors className="h-6 w-6" aria-hidden="true" />}
            title="Nenhum profissional cadastrado"
            description="Cadastre quem atende para que a agenda comece a funcionar."
            action={
              <Button onClick={() => setCreating(true)}>
                Cadastrar profissional
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {barbers.map((barber) => (
              <li key={barber.id}>
                <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="overflow-hidden rounded-full">
                      <Avatar
                        name={barber.name}
                        photoUrl={barber.photoUrl}
                        size="md"
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-ink">
                          {barber.name}
                        </p>
                        {barber.isAdmin && <Badge tone="brand">Admin</Badge>}
                        {!barber.isActive && (
                          <Badge tone="neutral">Inativo</Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-ink-subtle">
                        {barber.email} · comissão{' '}
                        {Math.round(Number(barber.commissionRate ?? 0.5) * 100)}%
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setHoursFor(barber)}
                    >
                      <CalendarClock className="h-4 w-4" aria-hidden="true" />
                      Jornada
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditing(barber)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resetPassword(barber)}
                      aria-label={`Gerar senha temporária para ${barber.name}`}
                    >
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        barber.isActive
                          ? setDeactivating(barber)
                          : toggleActive(barber)
                      }
                      aria-label={
                        barber.isActive
                          ? `Desativar ${barber.name}`
                          : `Reativar ${barber.name}`
                      }
                    >
                      <Power className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>

      {(creating || editing) && (
        <BarberDialog
          barber={editing}
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

      {hoursFor && (
        <WorkingHoursEditor
          barber={hoursFor}
          onClose={() => setHoursFor(null)}
        />
      )}

      <ConfirmDialog
        open={deactivating !== null}
        title="Desativar profissional?"
        description={
          deactivating
            ? `${deactivating.name} sai da agenda e do site, mas o histórico de atendimentos é mantido para o financeiro. Você pode reativar quando quiser.`
            : ''
        }
        confirmLabel="Desativar"
        loading={pending}
        onConfirm={() => deactivating && toggleActive(deactivating)}
        onCancel={() => setDeactivating(null)}
      />
    </>
  );
}

function BarberDialog({
  barber,
  onClose,
  onDone,
}: {
  barber: Barber | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(barber?.name ?? '');
  const [email, setEmail] = useState(barber?.email ?? '');
  const [phone, setPhone] = useState(barber?.phoneNumber ?? '');
  const [photoUrl, setPhotoUrl] = useState(barber?.photoUrl ?? '');
  const [bio, setBio] = useState(barber?.bio ?? '');
  const [isAdmin, setIsAdmin] = useState(barber?.isAdmin ?? false);
  const [commission, setCommission] = useState(
    String(Math.round(Number(barber?.commissionRate ?? 0.5) * 100)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const body = {
      name,
      email,
      phoneNumber: phone || undefined,
      photoUrl: photoUrl || undefined,
      bio: bio || undefined,
      isAdmin,
      // A API guarda fração; a tela pergunta em porcentagem, que é como o
      // dono da barbearia pensa.
      commissionRate: Number(commission) / 100,
    };

    try {
      if (barber) {
        await api(`/admin/barbers/${barber.id}`, {
          method: 'PUT',
          auth: true,
          body: { ...body, isActive: barber.isActive },
        });
        toast.success('Profissional atualizado');
      } else {
        const created = await api<{ temporaryPassword: string }>(
          '/admin/barbers',
          { method: 'POST', auth: true, body },
        );
        toast.success(
          'Profissional cadastrado',
          `Senha temporária: ${created.temporaryPassword} — será trocada no primeiro acesso.`,
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
      title={barber ? 'Editar profissional' : 'Novo profissional'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="barber-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="barber-form" onSubmit={submit} className="space-y-4">
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

        <Field label="E-mail de acesso">
          {(props) => (
            <Input
              {...props}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
          label="Foto (URL)"
          hint="Sem foto, o site mostra as iniciais sobre o fundo da marca."
        >
          {(props) => (
            <Input
              {...props}
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://…"
            />
          )}
        </Field>

        <Field label="Apresentação" hint="Aparece na página inicial.">
          {(props) => (
            <Textarea
              {...props}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={400}
              rows={2}
              placeholder="Ex.: especialista em degradê e barba na navalha."
            />
          )}
        </Field>

        <Field label="Comissão (%)" error={error}>
          {(props) => (
            <Input
              {...props}
              type="number"
              min={0}
              max={100}
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              required
            />
          )}
        </Field>

        <Checkbox
          label="Administrador"
          description="Acessa clientes, equipe, ajustes e o financeiro da barbearia inteira."
          checked={isAdmin}
          onChange={(e) => setIsAdmin(e.target.checked)}
        />
      </form>
    </Modal>
  );
}

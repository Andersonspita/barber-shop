'use client';

import React, { useCallback, useState } from 'react';
import { CalendarOff, Plus, Save, Scissors, Trash2 } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/use-session';
import { useAsyncData } from '@/lib/use-async-data';
import { ADMIN_NAV } from '@/lib/nav';
import { formatBRL, formatDate, todayISO } from '@/lib/format';
import { AppHeader, PageHeading } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

interface Settings {
  name: string;
  timezone: string;
  slotIntervalMinutes: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
  cancellationWindowMinutes: number;
  addressLine: string | null;
  city: string | null;
  mapsUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  about: string | null;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string | number;
  isActive: boolean;
  _count?: { appointments: number };
}

interface Holiday {
  id: string;
  date: string;
  description: string;
}

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Cuiaba',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Bahia',
  'America/Rio_Branco',
  'America/Noronha',
];

type Tab = 'ajustes' | 'servicos' | 'feriados';

export default function ShopPage() {
  const { user, ready } = useSession('ADMIN');
  const [tab, setTab] = useState<Tab>('ajustes');

  if (!ready || !user) return null;

  return (
    <>
      <AppHeader
        area="Painel"
        subtitle="Barbearia"
        items={ADMIN_NAV}
        loginPath="/login?area=profissional"
      />

      <main id="conteudo" className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <PageHeading
          title="Barbearia"
          description="Dados da casa, regras da agenda, serviços e feriados."
        />

        <div
          role="tablist"
          aria-label="Seções"
          className="mb-6 inline-flex gap-1 rounded-xl bg-surface-2 p-1"
        >
          {(
            [
              ['ajustes', 'Ajustes'],
              ['servicos', 'Serviços'],
              ['feriados', 'Feriados'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-bold transition-colors',
                tab === value
                  ? 'bg-brand-500 text-surface-0'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'ajustes' && <SettingsTab />}
        {tab === 'servicos' && <ServicesTab />}
        {tab === 'feriados' && <HolidaysTab />}
      </main>
    </>
  );
}

function SettingsTab() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(
    () => api<Settings>('/admin/shop', { auth: true }),
    [],
  );
  const { data: loaded } = useAsyncData(fetchSettings);

  // O formulário guarda só os campos tocados e os sobrepõe ao que veio do
  // servidor. Assim não é preciso copiar o objeto inteiro para o estado
  // quando ele chega — e não há efeito sincronizando as duas cópias.
  const [draft, setDraft] = useState<Partial<Settings>>({});
  const settings = loaded ? { ...loaded, ...draft } : null;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings) return;

    setSaving(true);
    try {
      await api('/admin/shop', {
        method: 'PUT',
        auth: true,
        body: {
          ...settings,
          addressLine: settings.addressLine || undefined,
          city: settings.city || undefined,
          mapsUrl: settings.mapsUrl || undefined,
          phone: settings.phone || undefined,
          whatsapp: settings.whatsapp || undefined,
          instagram: settings.instagram || undefined,
          about: settings.about || undefined,
        },
      });
      toast.success('Ajustes salvos');
    } catch (caught) {
      toast.error(
        'Não foi possível salvar',
        caught instanceof ApiError ? caught.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader
          title="Regras da agenda"
          description="Valem para todos os profissionais."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {/* O fuso deixou de ser o do contêiner e passou a ser uma escolha
              da barbearia: era daqui que vinham os horários deslocados. */}
          <Field
            label="Fuso horário"
            hint="Define o horário que o cliente enxerga na agenda."
          >
            {(props) => (
              <Select
                {...props}
                value={settings.timezone}
                onChange={(e) => update('timezone', e.target.value)}
              >
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace('America/', '').replace('_', ' ')}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Intervalo entre horários (min)"
            hint="De quanto em quanto tempo a agenda abre uma vaga."
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                min={5}
                max={120}
                step={5}
                value={settings.slotIntervalMinutes}
                onChange={(e) =>
                  update('slotIntervalMinutes', Number(e.target.value))
                }
              />
            )}
          </Field>

          <Field
            label="Antecedência mínima (min)"
            hint="Quanto tempo antes o cliente ainda consegue marcar."
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                max={1440}
                step={5}
                value={settings.minAdvanceMinutes}
                onChange={(e) =>
                  update('minAdvanceMinutes', Number(e.target.value))
                }
              />
            )}
          </Field>

          <Field
            label="Agenda aberta por (dias)"
            hint="Até quando o cliente pode marcar no futuro."
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                min={1}
                max={365}
                value={settings.maxAdvanceDays}
                onChange={(e) =>
                  update('maxAdvanceDays', Number(e.target.value))
                }
              />
            )}
          </Field>

          <Field
            label="Prazo para cancelar (min)"
            hint="Abaixo disso, só a barbearia cancela. Use 0 para liberar sempre."
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                max={10080}
                step={30}
                value={settings.cancellationWindowMinutes}
                onChange={(e) =>
                  update('cancellationWindowMinutes', Number(e.target.value))
                }
              />
            )}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Dados da barbearia"
          description="Aparecem na página inicial e nas mensagens enviadas ao cliente."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome">
            {(props) => (
              <Input
                {...props}
                value={settings.name}
                onChange={(e) => update('name', e.target.value)}
                required
              />
            )}
          </Field>

          <Field label="Cidade e estado">
            {(props) => (
              <Input
                {...props}
                value={settings.city ?? ''}
                onChange={(e) => update('city', e.target.value)}
                placeholder="São Paulo, SP"
              />
            )}
          </Field>

          <div className="sm:col-span-2">
            <Field label="Endereço">
              {(props) => (
                <Input
                  {...props}
                  value={settings.addressLine ?? ''}
                  onChange={(e) => update('addressLine', e.target.value)}
                  placeholder="Rua das Tesouras, 120 — Centro"
                />
              )}
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label="Link do Google Maps"
              hint="O botão “Abrir no mapa” da página inicial."
            >
              {(props) => (
                <Input
                  {...props}
                  type="url"
                  value={settings.mapsUrl ?? ''}
                  onChange={(e) => update('mapsUrl', e.target.value)}
                  placeholder="https://maps.google.com/…"
                />
              )}
            </Field>
          </div>

          <Field label="Telefone">
            {(props) => (
              <Input
                {...props}
                type="tel"
                value={settings.phone ?? ''}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="(11) 3000-0000"
              />
            )}
          </Field>

          <Field label="WhatsApp">
            {(props) => (
              <Input
                {...props}
                type="tel"
                value={settings.whatsapp ?? ''}
                onChange={(e) => update('whatsapp', e.target.value)}
                placeholder="11900000000"
              />
            )}
          </Field>

          <Field label="Instagram" hint="Só o nome de usuário.">
            {(props) => (
              <Input
                {...props}
                value={settings.instagram ?? ''}
                onChange={(e) => update('instagram', e.target.value)}
                placeholder="suabarbearia"
              />
            )}
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Sobre a barbearia"
              hint="O texto de abertura da página inicial."
            >
              {(props) => (
                <Textarea
                  {...props}
                  value={settings.about ?? ''}
                  onChange={(e) => update('about', e.target.value)}
                  maxLength={1000}
                  rows={3}
                />
              )}
            </Field>
          </div>
        </CardBody>
      </Card>

      <Button type="submit" loading={saving}>
        <Save className="h-4 w-4" aria-hidden="true" />
        Salvar ajustes
      </Button>
    </form>
  );
}

function ServicesTab() {
  const toast = useToast();
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState<Service | null>(null);
  const [pending, setPending] = useState(false);

  const fetchServices = useCallback(
    () => api<Service[]>('/admin/services', { auth: true }),
    [],
  );
  const { data: services, loading, reload: load } = useAsyncData(fetchServices);

  const deactivate = async () => {
    if (!deactivating) return;
    setPending(true);
    try {
      await api(`/admin/services/${deactivating.id}`, {
        method: 'DELETE',
        auth: true,
      });
      toast.success('Serviço desativado', 'Ele some do site e da agenda.');
      setDeactivating(null);
      void load();
    } catch (caught) {
      toast.error(
        'Não foi possível desativar',
        caught instanceof ApiError ? caught.message : undefined,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo serviço
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : !services || services.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <Scissors
            className="mx-auto mb-3 h-8 w-8 text-ink-subtle"
            aria-hidden="true"
          />
          <p className="text-sm text-ink-muted">
            Nenhum serviço cadastrado. Sem eles, ninguém consegue agendar.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {services.map((service) => (
            <li key={service.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{service.name}</p>
                    {!service.isActive && <Badge tone="neutral">Inativo</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs tabular text-ink-subtle">
                    {formatBRL(service.price)} · {service.durationMinutes} min
                    {service._count
                      ? ` · ${service._count.appointments} atendimento(s)`
                      : ''}
                  </p>
                  {service.description && (
                    <p className="mt-1 max-w-prose text-xs text-ink-muted">
                      {service.description}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditing(service)}
                  >
                    Editar
                  </Button>
                  {service.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeactivating(service)}
                      aria-label={`Desativar ${service.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <ServiceDialog
          service={editing}
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

      <ConfirmDialog
        open={deactivating !== null}
        title="Desativar serviço?"
        description={`${deactivating?.name ?? ''} sai do site e da tela de agendamento. Os atendimentos já registrados são preservados, e você pode reativar editando o serviço.`}
        confirmLabel="Desativar"
        loading={pending}
        onConfirm={deactivate}
        onCancel={() => setDeactivating(null)}
      />
    </>
  );
}

function ServiceDialog({
  service,
  onClose,
  onDone,
}: {
  service: Service | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [duration, setDuration] = useState(
    String(service?.durationMinutes ?? 30),
  );
  const [price, setPrice] = useState(String(Number(service?.price ?? 0)));
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const body = {
      name,
      description: description || undefined,
      durationMinutes: Number(duration),
      price: Number(price),
      isActive,
    };

    try {
      if (service) {
        await api(`/admin/services/${service.id}`, {
          method: 'PUT',
          auth: true,
          body,
        });
        toast.success('Serviço atualizado');
      } else {
        await api('/admin/services', { method: 'POST', auth: true, body });
        toast.success('Serviço criado');
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
      title={service ? 'Editar serviço' : 'Novo serviço'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="service-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="service-form" onSubmit={submit} className="space-y-4">
        <Field label="Nome">
          {(props) => (
            <Input
              {...props}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ex.: Corte + Barba"
            />
          )}
        </Field>

        {/* Cada serviço passa a ter seu texto. Antes a landing repetia a
            mesma descrição inventada em todos os cards. */}
        <Field
          label="Descrição"
          hint="Aparece no card do serviço, na página inicial."
        >
          {(props) => (
            <Textarea
              {...props}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="O que está incluído neste serviço?"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Duração (min)">
            {(props) => (
              <Input
                {...props}
                type="number"
                min={5}
                max={600}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            )}
          </Field>

          <Field label="Preço (R$)" error={error}>
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            )}
          </Field>
        </div>

        <Checkbox
          label="Serviço ativo"
          description="Inativo, some do site e da tela de agendamento."
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
      </form>
    </Modal>
  );
}

function HolidaysTab() {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchHolidays = useCallback(
    () => api<Holiday[]>('/admin/holidays', { auth: true }),
    [],
  );
  const { data: holidays, loading, reload: load } = useAsyncData(fetchHolidays);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api('/admin/holidays', {
        method: 'POST',
        auth: true,
        body: { date, description },
      });
      toast.success('Fechamento cadastrado', 'A agenda fica fechada nesta data.');
      setDescription('');
      void load();
    } catch (caught) {
      toast.error(
        'Não foi possível cadastrar',
        caught instanceof ApiError ? caught.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (holiday: Holiday) => {
    try {
      await api(`/admin/holidays/${holiday.id}`, {
        method: 'DELETE',
        auth: true,
      });
      void load();
    } catch (caught) {
      toast.error(
        'Não foi possível remover',
        caught instanceof ApiError ? caught.message : undefined,
      );
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Fechar um dia"
          description="Feriado, reforma, confraternização — a barbearia inteira fica fora da agenda."
        />
        <CardBody>
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <Field label="Data">
              {(props) => (
                <input
                  {...props}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="h-12 rounded-xl border border-line-strong bg-surface-2 px-4 text-sm text-ink focus:border-brand-500"
                />
              )}
            </Field>

            <div className="min-w-56 flex-1">
              <Field label="Motivo">
                {(props) => (
                  <Input
                    {...props}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    maxLength={120}
                    placeholder="Ex.: Feriado municipal"
                  />
                )}
              </Field>
            </div>

            <Button type="submit" loading={saving}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar
            </Button>
          </form>
        </CardBody>
      </Card>

      {loading ? (
        <Skeleton className="h-32" />
      ) : !holidays || holidays.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <CalendarOff
            className="mx-auto mb-3 h-8 w-8 text-ink-subtle"
            aria-hidden="true"
          />
          <p className="text-sm text-ink-muted">
            Nenhum fechamento cadastrado. Nos outros dias vale a jornada de cada
            profissional.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {holidays.map((holiday) => (
            <li key={holiday.id}>
              <Card className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-semibold tabular text-ink">
                    {formatDate(holiday.date)}
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {holiday.description}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(holiday)}
                  aria-label={`Remover fechamento de ${formatDate(holiday.date)}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CreditCard,
  ExternalLink,
  KeyRound,
  LogOut,
  MessageCircle,
  Pencil,
  Plus,
  Power,
  Store,
} from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useAsyncData } from '@/lib/use-async-data';
import { formatBRL, formatDate, todayISO } from '@/lib/format';
import {
  BILLING_STATUS,
  BillingStatus,
  BillingSummary,
  INVOICE_STATUS,
  InvoiceView,
  PlanView,
  planCapacity,
} from '@/lib/billing';

interface PlatformShop {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  isActive: boolean;
  whatsappInstance: string | null;
  createdAt: string;
  barbers: number;
  clients: number;
  appointments: number;
  billing: {
    status: BillingStatus;
    exempt: boolean;
    plan: PlanView | null;
    trialEndsAt: string | null;
    nextAmount: string | null;
    openInvoice: InvoiceView | null;
  };
}

type Call = <T>(
  path: string,
  init?: { method?: string; body?: unknown },
) => Promise<T>;

interface CreatedShop {
  shop: { id: string; slug: string; name: string };
  admin: { name: string; email: string; temporaryPassword: string };
}

const KEY_STORAGE = 'platform_key';

const TIMEZONES = [
  ['America/Sao_Paulo', 'Brasília (SP, RJ, MG, Sul, GO, DF…)'],
  ['America/Bahia', 'Bahia'],
  ['America/Recife', 'Pernambuco, Paraíba, RN, Alagoas, Sergipe'],
  ['America/Fortaleza', 'Ceará, Piauí, Maranhão'],
  ['America/Belem', 'Pará, Amapá'],
  ['America/Manaus', 'Amazonas'],
  ['America/Cuiaba', 'Mato Grosso'],
  ['America/Campo_Grande', 'Mato Grosso do Sul'],
  ['America/Porto_Velho', 'Rondônia'],
  ['America/Boa_Vista', 'Roraima'],
  ['America/Rio_Branco', 'Acre'],
  ['America/Noronha', 'Fernando de Noronha'],
] as const;

/**
 * Operação da plataforma: cadastrar barbearias, suspender e apontar o
 * WhatsApp de cada uma.
 *
 * Não usa login de usuário — toda conta pertence a uma barbearia. O acesso é
 * a chave `PLATFORM_ADMIN_KEY` do servidor, guardada só nesta aba
 * (sessionStorage) enquanto ela estiver aberta.
 */
export default function PlatformPage() {
  const toast = useToast();
  const [key, setKey] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedShop | null>(null);
  const [billingShop, setBillingShop] = useState<PlatformShop | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);

  const call = useCallback(
    <T,>(path: string, init: { method?: string; body?: unknown } = {}) =>
      api<T>(path, { ...init, headers: { 'X-Platform-Key': key ?? '' } }),
    [key],
  );

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(KEY_STORAGE);
      // Lido depois da montagem: o sessionStorage não existe no servidor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setKey(saved);
    } catch {
      // Navegação privada com storage bloqueado: pede a chave de novo.
    }
  }, []);

  const fetchShops = useCallback(
    () =>
      key ? call<PlatformShop[]>('/platform/shops') : Promise.resolve(null),
    [key, call],
  );
  const { data: shops, loading, error, reload } = useAsyncData(fetchShops);

  const forgetKey = () => {
    try {
      window.sessionStorage.removeItem(KEY_STORAGE);
    } catch {}
    setKey(null);
  };

  const submitKey = (event: React.FormEvent) => {
    event.preventDefault();
    const value = keyDraft.trim();
    if (!value) return;
    try {
      window.sessionStorage.setItem(KEY_STORAGE, value);
    } catch {}
    setKey(value);
    setKeyDraft('');
  };

  const update = async (
    shop: PlatformShop,
    patch: Partial<
      Pick<PlatformShop, 'isActive' | 'whatsappInstance' | 'slug'>
    >,
    message: string,
  ): Promise<boolean> => {
    try {
      await call(`/platform/shops/${shop.id}`, {
        method: 'PATCH',
        body: patch,
      });
      toast.success(message);
      reload();
      return true;
    } catch (caught) {
      toast.error(
        'Não foi possível salvar',
        caught instanceof ApiError ? caught.message : undefined,
      );
      return false;
    }
  };

  const keyRejected =
    error !== null && (error.status === 403 || error.status === 404);

  if (!key || keyRejected) {
    return (
      <main
        id="conteudo"
        className="flex min-h-dvh items-center justify-center px-4 py-10"
      >
        <Card className="w-full max-w-sm p-6 sm:p-8">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-surface-0">
            <KeyRound className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="text-center font-display text-2xl font-extrabold tracking-tight text-ink">
            Plataforma
          </h1>
          <p className="mb-6 mt-1 text-center text-sm text-ink-muted">
            Informe a chave <code>PLATFORM_ADMIN_KEY</code> do servidor.
          </p>
          {keyRejected && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              {error.status === 404
                ? 'O painel da plataforma está desligado: defina PLATFORM_ADMIN_KEY no servidor.'
                : 'Chave inválida.'}
            </p>
          )}
          <form onSubmit={submitKey} className="space-y-4">
            <Field label="Chave da plataforma">
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="off"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" block size="lg">
              Entrar
            </Button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-surface-0/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 font-display text-sm font-black text-surface-0"
              aria-hidden="true"
            >
              GB
            </span>
            <div>
              <p className="text-sm font-bold leading-tight text-ink">
                Gerente Barber
              </p>
              <p className="text-xs text-ink-subtle">Painel da plataforma</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={forgetKey}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </Button>
        </div>
      </header>

      <main
        id="conteudo"
        className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6"
      >
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Barbearias
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Cada uma com equipe, clientes, agenda e endereço próprios.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPlansOpen(true)}>
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Planos e preços
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nova barbearia
            </Button>
          </div>
        </div>

        {error && !keyRejected && (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            {error.message}
          </p>
        )}

        {loading && !shops ? (
          <SkeletonList count={3} className="h-28" />
        ) : !shops || shops.length === 0 ? (
          <EmptyState
            icon={<Store className="h-6 w-6" aria-hidden="true" />}
            title="Nenhuma barbearia ainda"
            description="Cadastre a primeira. Ela já nasce com um administrador para montar equipe e serviços."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nova barbearia
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {shops.map((shop) => (
              <li key={shop.id}>
                <ShopRow
                  shop={shop}
                  onUpdate={update}
                  onBilling={() => setBillingShop(shop)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {billingShop && (
        <ShopBillingDialog
          shop={billingShop}
          call={call}
          onClose={() => setBillingShop(null)}
          onChanged={reload}
        />
      )}

      {plansOpen && (
        <PlansDialog
          call={call}
          onClose={() => setPlansOpen(false)}
          onChanged={reload}
        />
      )}

      {creating && (
        <CreateShopDialog
          call={call}
          onClose={() => setCreating(false)}
          onCreated={(result) => {
            setCreating(false);
            setCreated(result);
            reload();
          }}
        />
      )}

      {created && (
        <Modal
          open
          onClose={() => setCreated(null)}
          title="Barbearia criada"
          description="Passe estes dados ao administrador. A senha é mostrada só agora e será trocada no primeiro acesso."
          footer={<Button onClick={() => setCreated(null)}>Pronto</Button>}
        >
          <dl className="divide-y divide-line rounded-xl border border-line bg-surface-2 text-sm">
            <CredentialRow
              label="Endereço"
              value={`${window.location.origin}/${created.shop.slug}`}
            />
            <CredentialRow
              label="Login do painel"
              value={`${window.location.origin}/${created.shop.slug}/login?area=profissional`}
            />
            <CredentialRow label="E-mail" value={created.admin.email} />
            <CredentialRow
              label="Senha temporária"
              value={created.admin.temporaryPassword}
              mono
            />
          </dl>
        </Modal>
      )}
    </>
  );
}

function ShopRow({
  shop,
  onUpdate,
  onBilling,
}: {
  shop: PlatformShop;
  onBilling: () => void;
  onUpdate: (
    shop: PlatformShop,
    patch: Partial<
      Pick<PlatformShop, 'isActive' | 'whatsappInstance' | 'slug'>
    >,
    message: string,
  ) => Promise<boolean>;
}) {
  const [instance, setInstance] = useState(shop.whatsappInstance ?? '');
  const dirty = instance.trim() !== (shop.whatsappInstance ?? '');
  const [editingSlug, setEditingSlug] = useState(false);

  return (
    <Card className={cn('p-5', !shop.isActive && 'opacity-70')}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-ink">
              {shop.name}
            </h2>
            <Badge tone={shop.isActive ? 'success' : 'danger'}>
              {shop.isActive ? 'Ativa' : 'Suspensa'}
            </Badge>
          </div>
          <a
            href={`/${shop.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-400 hover:text-brand-300"
          >
            /{shop.slug}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => setEditingSlug(true)}
            className="ml-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-subtle transition-colors hover:text-ink"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Alterar endereço
          </button>
          <p className="mt-1 text-xs tabular text-ink-subtle">
            {[
              shop.city,
              `${shop.barbers} ${shop.barbers === 1 ? 'profissional' : 'profissionais'}`,
              `${shop.clients} ${shop.clients === 1 ? 'cliente' : 'clientes'}`,
              `${shop.appointments} ${shop.appointments === 1 ? 'agendamento' : 'agendamentos'}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <BillingLine billing={shop.billing} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void onUpdate(
                shop,
                { whatsappInstance: instance.trim() },
                instance.trim()
                  ? 'Instância de WhatsApp salva'
                  : 'Voltou para o WhatsApp da plataforma',
              );
            }}
          >
            <div className="w-52">
              <Field
                label="Instância WhatsApp"
                hint="Vazio = número da plataforma"
              >
                {(props) => (
                  <Input
                    {...props}
                    value={instance}
                    onChange={(e) => setInstance(e.target.value)}
                    placeholder="padrão"
                    className="h-10"
                  />
                )}
              </Field>
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={!dirty}
              className="mb-[22px] h-10"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Salvar
            </Button>
          </form>

          <Button
            variant="secondary"
            size="sm"
            className="h-10 sm:mb-[22px]"
            onClick={onBilling}
          >
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            Assinatura
          </Button>

          <Button
            variant={shop.isActive ? 'danger' : 'success'}
            size="sm"
            className="h-10 sm:mb-[22px]"
            onClick={() =>
              void onUpdate(
                shop,
                { isActive: !shop.isActive },
                shop.isActive
                  ? `${shop.name} suspensa: saiu do ar e as sessões caíram.`
                  : `${shop.name} reativada.`,
              )
            }
          >
            <Power className="h-4 w-4" aria-hidden="true" />
            {shop.isActive ? 'Suspender' : 'Reativar'}
          </Button>
        </div>
      </div>
      {editingSlug && (
        <ChangeSlugDialog
          shop={shop}
          onClose={() => setEditingSlug(false)}
          onSave={async (slug) => {
            const saved = await onUpdate(
              shop,
              { slug },
              `Endereço alterado para /${slug}.`,
            );
            if (saved) setEditingSlug(false);
          }}
        />
      )}
    </Card>
  );
}

/**
 * Troca o endereço público da barbearia. O link antigo para de funcionar na
 * hora — não há redirecionamento —, então o aviso vem antes da confirmação.
 */
function ChangeSlugDialog({
  shop,
  onClose,
  onSave,
}: {
  shop: PlatformShop;
  onClose: () => void;
  onSave: (slug: string) => Promise<void>;
}) {
  const [slug, setSlug] = useState(shop.slug);
  const [saving, setSaving] = useState(false);
  const clean = slugify(slug);
  const changed = clean.length > 0 && clean !== shop.slug;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!changed) return;
    setSaving(true);
    try {
      await onSave(clean);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Alterar endereço"
      description={shop.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="change-slug"
            loading={saving}
            disabled={!changed}
          >
            Salvar endereço
          </Button>
        </>
      }
    >
      <form id="change-slug" onSubmit={submit} className="space-y-4">
        <Field
          label="Novo endereço (slug)"
          hint={`Vitrine em /${clean || 'endereco'} · letras minúsculas, números e hífen`}
        >
          {(props) => (
            <Input
              {...props}
              required
              autoFocus
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value, true))}
            />
          )}
        </Field>
        <p
          role="note"
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm leading-relaxed text-danger"
        >
          O link antigo <strong>/{shop.slug}</strong> deixa de funcionar na
          hora. Avise a barbearia para atualizar o link no Instagram, no Google
          e no WhatsApp. Contas, agenda e histórico continuam iguais; quem
          estiver logado só precisa entrar de novo no endereço novo.
        </p>
      </form>
    </Modal>
  );
}

function CreateShopDialog({
  call,
  onClose,
  onCreated,
}: {
  call: <T>(
    path: string,
    init?: { method?: string; body?: unknown },
  ) => Promise<T>;
  onClose: () => void;
  onCreated: (result: CreatedShop) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [city, setCity] = useState('');
  const [timezone, setTimezone] = useState<string>(TIMEZONES[0][0]);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [planCode, setPlanCode] = useState('solo');
  const [trialDays, setTrialDays] = useState('14');
  const fetchPlans = useCallback(
    () => call<PlanView[]>('/platform/plans'),
    [call],
  );
  const { data: plans } = useAsyncData(fetchPlans);
  const [saving, setSaving] = useState(false);

  // O endereço acompanha o nome até alguém editá-lo à mão.
  const effectiveSlug = slugTouched ? slug : slugify(name);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await call<CreatedShop>('/platform/shops', {
        method: 'POST',
        body: {
          name,
          slug: effectiveSlug,
          city: city || undefined,
          timezone,
          adminName,
          adminEmail,
          adminPhone: adminPhone || undefined,
          planCode,
          trialDays: Math.max(0, Math.floor(Number(trialDays) || 0)),
        },
      });
      onCreated(result);
    } catch (caught) {
      toast.error(
        'Não foi possível criar',
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
      title="Nova barbearia"
      description="Ela já nasce com um administrador, que monta equipe, serviços e horários pelo painel."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="create-shop" loading={saving}>
            Criar barbearia
          </Button>
        </>
      }
    >
      <form id="create-shop" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da barbearia">
            {(props) => (
              <Input
                {...props}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Navalha de Ouro"
              />
            )}
          </Field>
          <Field
            label="Endereço (slug)"
            hint={`Vitrine em /${effectiveSlug || 'endereco'}`}
          >
            {(props) => (
              <Input
                {...props}
                required
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value, true));
                }}
                placeholder="navalha-de-ouro"
              />
            )}
          </Field>
          <Field label="Cidade">
            {(props) => (
              <Input
                {...props}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Recife, PE"
              />
            )}
          </Field>
          <Field label="Fuso horário">
            {(props) => (
              <Select
                {...props}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Primeiro administrador
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              {(props) => (
                <Input
                  {...props}
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                />
              )}
            </Field>
            <Field label="E-mail">
              {(props) => (
                <Input
                  {...props}
                  required
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              )}
            </Field>
            <Field label="WhatsApp" hint="Opcional">
              {(props) => (
                <Input
                  {...props}
                  type="tel"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder="(81) 99999-0000"
                />
              )}
            </Field>
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Mensalidade
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plano">
              {(props) => (
                <Select
                  {...props}
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value)}
                >
                  {(plans ?? []).map((plan) => (
                    <option key={plan.code} value={plan.code}>
                      {plan.name} · {formatBRL(plan.monthlyPrice)} ·{' '}
                      {planCapacity(plan, formatBRL)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Dias de teste grátis" hint="0 = cobra desde hoje">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={0}
                  max={365}
                  value={trialDays}
                  onChange={(e) => setTrialDays(e.target.value)}
                />
              )}
            </Field>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

/** Plano, situação e fatura aberta, numa linha abaixo dos números da barbearia. */
function BillingLine({ billing }: { billing: PlatformShop['billing'] }) {
  const status = BILLING_STATUS[billing.status];
  const parts = [
    billing.plan &&
      `Plano ${billing.plan.name}${
        !billing.exempt && billing.nextAmount
          ? ` · ${formatBRL(billing.nextAmount)}/mês`
          : ''
      }`,
    billing.status === 'TRIAL' &&
      billing.trialEndsAt &&
      `teste até ${formatDate(billing.trialEndsAt)}`,
    billing.openInvoice &&
      `fatura de ${formatBRL(billing.openInvoice.amount)} ${
        billing.openInvoice.dueDate < todayISO() ? 'venceu' : 'vence'
      } em ${formatDate(billing.openInvoice.dueDate)}`,
  ].filter(Boolean);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
      <Badge tone={status.tone}>{status.label}</Badge>
      <span>{parts.join(' · ')}</span>
    </div>
  );
}

/**
 * Assinatura de uma barbearia: plano, cortesia, teste grátis e faturas, com
 * baixa manual — o pagamento ainda é recebido por fora (Pix, transferência).
 */
function ShopBillingDialog({
  shop,
  call,
  onClose,
  onChanged,
}: {
  shop: PlatformShop;
  call: Call;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const fetchSummary = useCallback(
    () => call<BillingSummary>(`/platform/shops/${shop.id}/billing`),
    [call, shop.id],
  );
  const { data, loading, reload } = useAsyncData(fetchSummary);
  const [busy, setBusy] = useState<string | null>(null);
  const [trialDraft, setTrialDraft] = useState<string | null>(null);

  const run = async (
    key: string,
    action: () => Promise<unknown>,
    message: string,
  ) => {
    setBusy(key);
    try {
      await action();
      toast.success(message);
      reload();
      onChanged();
    } catch (caught) {
      toast.error(
        'Não foi possível salvar',
        caught instanceof ApiError ? caught.message : undefined,
      );
    } finally {
      setBusy(null);
    }
  };

  const patchShop = (body: Record<string, unknown>) =>
    call(`/platform/shops/${shop.id}`, { method: 'PATCH', body });
  const setInvoice = (invoice: InvoiceView, status: InvoiceView['status']) =>
    call(`/platform/invoices/${invoice.id}`, {
      method: 'PATCH',
      body: {
        status,
        ...(status === 'PAID'
          ? { note: `Baixa manual em ${formatDate(todayISO())}` }
          : {}),
      },
    });

  const trialValue = trialDraft ?? data?.trialEndsAt ?? '';

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assinatura · ${shop.name}`}
      description="Sem operadora de pagamento: a barbearia paga por fora e você dá a baixa aqui."
      size="lg"
      footer={<Button onClick={onClose}>Fechar</Button>}
    >
      {loading && !data ? (
        <SkeletonList count={2} className="h-24" />
      ) : data ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={BILLING_STATUS[data.status].tone}>
              {BILLING_STATUS[data.status].label}
            </Badge>
            <span className="text-sm text-ink-muted">
              {data.activeBarbers}{' '}
              {data.activeBarbers === 1
                ? 'profissional ativo'
                : 'profissionais ativos'}
              {data.nextAmount && !data.exempt && (
                <> · próxima fatura {formatBRL(data.nextAmount)}</>
              )}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Plano"
              hint="Precisa comportar a equipe ativa. Vale na próxima fatura."
            >
              {(props) => (
                <Select
                  {...props}
                  value={data.plan?.code ?? ''}
                  disabled={busy !== null}
                  onChange={(e) =>
                    void run(
                      'plan',
                      () => patchShop({ planCode: e.target.value }),
                      'Plano alterado.',
                    )
                  }
                >
                  {data.plans.map((plan) => (
                    <option
                      key={plan.code}
                      value={plan.code}
                      disabled={!plan.fits}
                    >
                      {plan.name} · {formatBRL(plan.monthlyPrice)}
                      {plan.fits ? '' : ' (não comporta a equipe)'}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label="Fim do teste grátis"
              hint="Vazio encerra o teste. A primeira fatura vence nessa data."
            >
              {(props) => (
                <div className="flex gap-2">
                  <Input
                    {...props}
                    type="date"
                    value={trialValue}
                    onChange={(e) => setTrialDraft(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    className="h-12"
                    disabled={
                      busy !== null || trialValue === (data.trialEndsAt ?? '')
                    }
                    onClick={() =>
                      void run(
                        'trial',
                        () => patchShop({ trialEndsAt: trialValue }),
                        'Teste grátis atualizado.',
                      ).then(() => setTrialDraft(null))
                    }
                  >
                    Salvar
                  </Button>
                </div>
              )}
            </Field>
          </div>

          <Checkbox
            label="Cortesia"
            description="Sem mensalidade e sem limite de profissionais. Faturas já emitidas continuam como estão."
            checked={data.exempt}
            disabled={busy !== null}
            onChange={(e) =>
              void run(
                'exempt',
                () => patchShop({ billingExempt: e.target.checked }),
                e.target.checked
                  ? 'Barbearia em cortesia.'
                  : 'Cortesia removida: a cobrança volta a valer.',
              )
            }
          />

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Faturas
              </p>
              <Button
                variant="secondary"
                size="sm"
                loading={busy === 'generate'}
                disabled={busy !== null || data.exempt}
                onClick={() =>
                  void run(
                    'generate',
                    () =>
                      call(`/platform/shops/${shop.id}/invoices`, {
                        method: 'POST',
                      }),
                    'Fatura gerada. O admin foi avisado no WhatsApp.',
                  )
                }
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Gerar próxima fatura
              </Button>
            </div>

            {data.invoices.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-muted">
                Nenhuma fatura ainda. Elas são geradas sozinhas alguns dias
                antes do vencimento.
              </p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {data.invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold tabular text-ink">
                        {formatBRL(invoice.amount)} · vence{' '}
                        {formatDate(invoice.dueDate)}
                      </p>
                      <p className="text-xs text-ink-subtle">
                        {formatDate(invoice.periodStart)} a{' '}
                        {formatDate(invoice.periodEnd)} · {invoice.planName} ·{' '}
                        {invoice.barbers}{' '}
                        {invoice.barbers === 1
                          ? 'profissional'
                          : 'profissionais'}
                        {invoice.note ? ` · ${invoice.note}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={INVOICE_STATUS[invoice.status].tone}>
                        {INVOICE_STATUS[invoice.status].label}
                      </Badge>
                      {invoice.status === 'OPEN' ? (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            loading={busy === `paid-${invoice.id}`}
                            disabled={busy !== null}
                            onClick={() =>
                              void run(
                                `paid-${invoice.id}`,
                                () => setInvoice(invoice, 'PAID'),
                                'Pagamento registrado.',
                              )
                            }
                          >
                            Marcar como paga
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy !== null}
                            onClick={() =>
                              void run(
                                `cancel-${invoice.id}`,
                                () => setInvoice(invoice, 'CANCELED'),
                                'Fatura cancelada.',
                              )
                            }
                          >
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() =>
                            void run(
                              `reopen-${invoice.id}`,
                              () => setInvoice(invoice, 'OPEN'),
                              'Fatura reaberta.',
                            )
                          }
                        >
                          Reabrir
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

/** Preços dos planos. Faturas já emitidas guardam o valor da época. */
function PlansDialog({
  call,
  onClose,
  onChanged,
}: {
  call: Call;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const fetchPlans = useCallback(
    () => call<PlanView[]>('/platform/plans'),
    [call],
  );
  const { data: plans, reload } = useAsyncData(fetchPlans);
  const [drafts, setDrafts] = useState<
    Record<string, { monthly: string; extra: string }>
  >({});
  const [saving, setSaving] = useState<string | null>(null);

  const draftFor = (plan: PlanView) =>
    drafts[plan.code] ?? {
      monthly: plan.monthlyPrice,
      extra: plan.extraBarberPrice ?? '',
    };

  const save = async (plan: PlanView) => {
    const draft = draftFor(plan);
    setSaving(plan.code);
    try {
      await call(`/platform/plans/${plan.code}`, {
        method: 'PATCH',
        body: {
          monthlyPrice: Number(draft.monthly.replace(',', '.')),
          ...(plan.maxBarbers === null && draft.extra !== ''
            ? { extraBarberPrice: Number(draft.extra.replace(',', '.')) }
            : {}),
        },
      });
      toast.success(
        `Preço do plano ${plan.name} salvo.`,
        'Vale para as próximas faturas.',
      );
      setDrafts((current) => {
        const next = { ...current };
        delete next[plan.code];
        return next;
      });
      reload();
      onChanged();
    } catch (caught) {
      toast.error(
        'Não foi possível salvar',
        caught instanceof ApiError ? caught.message : undefined,
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Planos e preços"
      description="Mudanças valem para as próximas faturas. As já emitidas guardam o valor da época."
      size="lg"
      footer={<Button onClick={onClose}>Fechar</Button>}
    >
      {!plans ? (
        <SkeletonList count={3} className="h-16" />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {plans.map((plan) => {
            const draft = draftFor(plan);
            const dirty =
              draft.monthly !== plan.monthlyPrice ||
              draft.extra !== (plan.extraBarberPrice ?? '');
            return (
              <li
                key={plan.code}
                className="flex flex-wrap items-end gap-3 px-4 py-3"
              >
                <div className="min-w-40 flex-1">
                  <p className="font-display font-bold text-ink">{plan.name}</p>
                  <p className="text-xs text-ink-subtle">
                    {planCapacity(plan, formatBRL)}
                  </p>
                </div>
                <div className="w-32">
                  <Field label="Mensal (R$)">
                    {(props) => (
                      <Input
                        {...props}
                        inputMode="decimal"
                        className="h-10"
                        value={draft.monthly}
                        onChange={(e) =>
                          setDrafts((current) => ({
                            ...current,
                            [plan.code]: { ...draft, monthly: e.target.value },
                          }))
                        }
                      />
                    )}
                  </Field>
                </div>
                {plan.maxBarbers === null && (
                  <div className="w-32">
                    <Field label="Por extra (R$)">
                      {(props) => (
                        <Input
                          {...props}
                          inputMode="decimal"
                          className="h-10"
                          value={draft.extra}
                          onChange={(e) =>
                            setDrafts((current) => ({
                              ...current,
                              [plan.code]: { ...draft, extra: e.target.value },
                            }))
                          }
                        />
                      )}
                    </Field>
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-10"
                  disabled={!dirty || saving !== null}
                  loading={saving === plan.code}
                  onClick={() => void save(plan)}
                >
                  Salvar
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

function CredentialRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-ink-subtle">{label}</dt>
      <dd
        className={cn(
          'break-all font-semibold text-ink sm:text-right',
          mono && 'font-mono text-base tracking-wider text-brand-400',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** "Navalha de Ouro" → "navalha-de-ouro". */
function slugify(value: string, keepTrailingDash = false): string {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 40);
  return keepTrailingDash ? slug : slug.replace(/-+$/, '');
}

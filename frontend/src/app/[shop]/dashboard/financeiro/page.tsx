'use client';

import React, { useCallback, useState } from 'react';
import { Download, Receipt } from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/use-session';
import { useAsyncData } from '@/lib/use-async-data';
import { staffNav } from '@/lib/nav';
import {
  addDaysISO,
  formatBRL,
  formatDate,
  formatDayMonth,
  formatTime,
  parseISODate,
  toISODate,
  todayISO,
} from '@/lib/format';
import { AppHeader, PageHeading } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, StatCard } from '@/components/ui/card';
import { Field, Select } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

interface Barber {
  id: string;
  name: string;
}

interface Detail {
  id: string;
  startTime: string;
  clientName: string;
  serviceName: string;
  barberName: string;
  price: number;
  commission: number;
}

interface Metrics {
  totalRevenue: number;
  totalCommission: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  ticketAverage: number;
  series: Array<{ date: string; revenue: number; count: number }>;
  details: Detail[];
}

type Preset = 'hoje' | 'semana' | 'mes' | 'personalizado';

export default function FinancePage() {
  const { user, ready } = useSession('STAFF');

  const [barberId, setBarberId] = useState('');
  const [preset, setPreset] = useState<Preset>('mes');
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(todayISO());

  const isAdmin = user?.isAdmin ?? false;

  const fetchBarbers = useCallback(
    () => (ready && isAdmin ? api<Barber[]>('/barbers') : Promise.resolve([])),
    [ready, isAdmin],
  );
  const { data: barberList } = useAsyncData(fetchBarbers);
  const barbers = barberList ?? [];

  const fetchMetrics = useCallback(
    () =>
      ready
        ? api<Metrics>('/appointments/metrics/advanced', {
            auth: true,
            query: { startDate, endDate, barberId: barberId || undefined },
          })
        : Promise.resolve(null as unknown as Metrics),
    [ready, startDate, endDate, barberId],
  );

  const { data: metrics, loading, error } = useAsyncData(fetchMetrics);

  const applyPreset = (value: Preset) => {
    setPreset(value);
    const today = todayISO();

    if (value === 'hoje') {
      setStartDate(today);
      setEndDate(today);
    } else if (value === 'semana') {
      const date = parseISODate(today);
      setStartDate(toISODate(new Date(date.setDate(date.getDate() - 6))));
      setEndDate(today);
    } else if (value === 'mes') {
      setStartDate(firstDayOfMonth());
      setEndDate(today);
    }
  };

  const exportCsv = () => {
    if (!metrics || metrics.details.length === 0) return;

    // O contador que pedia os dados recebia um print da tela.
    const header = [
      'Data',
      'Hora',
      'Cliente',
      'Serviço',
      'Profissional',
      'Valor',
      'Comissão',
    ];
    const rows = metrics.details.map((detail) => [
      formatDate(detail.startTime),
      formatTime(detail.startTime),
      detail.clientName,
      detail.serviceName,
      detail.barberName,
      detail.price.toFixed(2).replace('.', ','),
      detail.commission.toFixed(2).replace('.', ','),
    ]);

    // Ponto e vírgula e BOM: é o que o Excel em português abre sem bagunçar.
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsv).join(';'))
      .join('\r\n');

    const blob = new Blob([`﻿${csv}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financeiro-${startDate}-a-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!ready || !user) return null;

  return (
    <>
      <AppHeader
        area="Painel"
        subtitle="Financeiro"
        items={staffNav(user.isAdmin)}
        loginPath="/login?area=profissional"
      />

      <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <PageHeading
          title="Financeiro"
          description="Faturamento, comissões e extrato do período."
          actions={
            <Button
              variant="secondary"
              onClick={exportCsv}
              disabled={!metrics || metrics.details.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportar CSV
            </Button>
          }
        />

        {/* -------------------------------------------------------- filtros */}
        <Card className="mb-6 p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div
              role="group"
              aria-label="Período rápido"
              className="flex gap-1 rounded-xl bg-surface-2 p-1"
            >
              {(
                [
                  ['hoje', 'Hoje'],
                  ['semana', '7 dias'],
                  ['mes', 'Este mês'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={preset === value}
                  onClick={() => applyPreset(value)}
                  className={cn(
                    'rounded-lg px-3.5 py-2 text-sm font-bold transition-colors',
                    preset === value
                      ? 'bg-brand-500 text-surface-0'
                      : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <Field label="De">
              {(props) => (
                <input
                  {...props}
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPreset('personalizado');
                  }}
                  className="h-12 rounded-xl border border-line-strong bg-surface-2 px-4 text-sm text-ink focus:border-brand-500"
                />
              )}
            </Field>

            <Field label="Até">
              {(props) => (
                <input
                  {...props}
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={addDaysISO(todayISO(), 1)}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPreset('personalizado');
                  }}
                  className="h-12 rounded-xl border border-line-strong bg-surface-2 px-4 text-sm text-ink focus:border-brand-500"
                />
              )}
            </Field>

            {user.isAdmin && (
              <div className="min-w-48">
                <Field label="Profissional">
                  {(props) => (
                    <Select
                      {...props}
                      value={barberId}
                      onChange={(e) => setBarberId(e.target.value)}
                    >
                      <option value="">Toda a equipe</option>
                      {barbers.map((barber) => (
                        <option key={barber.id} value={barber.id}>
                          {barber.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            )}
          </div>
        </Card>

        {/* Falha no relatório não derruba a tela: os filtros continuam de pé. */}
        {error && error.status !== 401 && (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            {error.message}
          </p>
        )}

        {/* -------------------------------------------------------- resumo */}
        <section
          aria-label="Resumo do período"
          className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {loading && !metrics ? (
            Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28" />
            ))
          ) : (
            <>
              <StatCard
                label="Faturamento"
                value={formatBRL(metrics?.totalRevenue ?? 0)}
                tone="brand"
              />
              <StatCard
                label="Comissões"
                value={formatBRL(metrics?.totalCommission ?? 0)}
                tone="success"
              />
              <StatCard
                label="Ticket médio"
                value={formatBRL(metrics?.ticketAverage ?? 0)}
                hint={`${metrics?.completedCount ?? 0} atendimentos`}
              />
              <StatCard
                label="Perdas"
                value={
                  (metrics?.noShowCount ?? 0) + (metrics?.cancelledCount ?? 0)
                }
                hint={`${metrics?.noShowCount ?? 0} faltas · ${metrics?.cancelledCount ?? 0} cancelados`}
                tone={metrics?.noShowCount ? 'danger' : 'default'}
              />
            </>
          )}
        </section>

        {/* -------------------------------------------------------- gráfico */}
        {metrics && metrics.series.length > 1 && (
          <Card className="mb-6">
            <CardHeader
              title="Faturamento por dia"
              description="Responde “como foi o mês?” sem precisar ler o extrato."
            />
            <CardBody>
              <RevenueChart series={metrics.series} />
            </CardBody>
          </Card>
        )}

        {/* -------------------------------------------------------- extrato */}
        <Card>
          <CardHeader
            title="Extrato detalhado"
            description="Somente atendimentos concluídos."
          />
          <CardBody>
            {loading ? (
              <SkeletonList count={4} className="h-16" />
            ) : !metrics || metrics.details.length === 0 ? (
              <EmptyState
                icon={<Receipt className="h-6 w-6" aria-hidden="true" />}
                title="Nenhum atendimento concluído"
                description="Escolha outro período ou conclua os atendimentos na agenda."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">
                    Atendimentos concluídos entre {formatDate(startDate)} e{' '}
                    {formatDate(endDate)}
                  </caption>
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-subtle">
                      <th scope="col" className="pb-3 pr-4 font-semibold">
                        Data
                      </th>
                      <th scope="col" className="pb-3 pr-4 font-semibold">
                        Cliente
                      </th>
                      <th scope="col" className="pb-3 pr-4 font-semibold">
                        Serviço
                      </th>
                      {user.isAdmin && (
                        <th scope="col" className="pb-3 pr-4 font-semibold">
                          Profissional
                        </th>
                      )}
                      <th scope="col" className="pb-3 pr-4 text-right font-semibold">
                        Valor
                      </th>
                      <th scope="col" className="pb-3 text-right font-semibold">
                        Comissão
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {metrics.details.map((detail) => (
                      <tr key={detail.id}>
                        <td className="py-3 pr-4 tabular text-ink-muted">
                          {formatDayMonth(detail.startTime)}{' '}
                          <span className="text-ink-subtle">
                            {formatTime(detail.startTime)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-semibold text-ink">
                          {detail.clientName}
                        </td>
                        <td className="py-3 pr-4 text-ink-muted">
                          {detail.serviceName}
                        </td>
                        {user.isAdmin && (
                          <td className="py-3 pr-4 text-brand-400">
                            {detail.barberName}
                          </td>
                        )}
                        <td className="py-3 pr-4 text-right font-bold tabular text-ink">
                          {formatBRL(detail.price)}
                        </td>
                        <td className="py-3 text-right font-semibold tabular text-success">
                          {formatBRL(detail.commission)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </main>
    </>
  );
}

/**
 * Barras em SVG puro. O relatório era só uma lista de valores — não havia
 * como enxergar a evolução do período sem ler linha por linha.
 */
function RevenueChart({
  series,
}: {
  series: Array<{ date: string; revenue: number; count: number }>;
}) {
  const max = Math.max(...series.map((point) => point.revenue), 1);

  return (
    <div className="overflow-x-auto">
      <div
        className="flex min-w-full items-end gap-1.5"
        style={{ minWidth: `${series.length * 28}px`, height: '180px' }}
        role="img"
        aria-label={`Faturamento diário de ${series.length} dias. Maior valor: ${formatBRL(max)}.`}
      >
        {series.map((point) => {
          const height = Math.max((point.revenue / max) * 100, 2);
          return (
            <div
              key={point.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
              style={{ height: '100%' }}
            >
              <div
                className="w-full rounded-t bg-brand-500/70 transition-colors group-hover:bg-brand-400"
                style={{ height: `${height}%` }}
              />
              <span className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-surface-3 px-2 py-1 text-xs font-semibold tabular text-ink group-hover:block">
                {formatDayMonth(point.date)} · {formatBRL(point.revenue)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-xs tabular text-ink-subtle">
        <span>{formatDayMonth(series[0].date)}</span>
        <span>{formatDayMonth(series[series.length - 1].date)}</span>
      </div>
    </div>
  );
}

function firstDayOfMonth(): string {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function escapeCsv(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

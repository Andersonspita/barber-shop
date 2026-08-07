"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, formatISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Barber {
  id: string;
  name: string;
}

interface FinancialDetail {
  id: string;
  startTime: string;
  clientName: string;
  serviceName: string;
  price: number;
  commission: number;
  barberName: string;
}

interface FinancialMetrics {
  totalRevenue: number;
  totalCommission: number;
  completedCount: number;
  details: FinancialDetail[];
}

export default function Financeiro() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [barberId, setBarberId] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Resultados
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      const userIsAdmin = localStorage.getItem('is_admin') === 'true';
      if (!token) {
        router.push('/login');
        return;
      }
      setIsAdmin(userIsAdmin);

      if (userIsAdmin) {
        // Fetch barbers for the select filter
        try {
          const res = await fetch('http://localhost:3333/barbers');
          if (res.ok) setBarbers(await res.json());
        } catch (err) {
          console.error(err);
        }
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, barberId]);

  const fetchMetrics = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    setLoading(true);
    try {
      let url = `http://localhost:3333/appointments/metrics/advanced?startDate=${startDate}&endDate=${endDate}`;
      if (barberId) url += `&barberId=${barberId}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setMetrics(await res.json());
      } else {
        const error = await res.json();
        console.error(error.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setPreset = (preset: 'HOJE' | 'SEMANA' | 'MES') => {
    const today = new Date();
    if (preset === 'HOJE') {
      setStartDate(format(today, 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === 'SEMANA') {
      setStartDate(format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'));
      setEndDate(format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'));
    } else if (preset === 'MES') {
      setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans">
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500 text-neutral-950 font-black text-sm">
              💰
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Relatórios Financeiros</h1>
              <span className="text-xs text-neutral-500">Métricas e Extrato</span>
            </div>
          </div>
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-green-500 transition-colors"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        
        {/* Painel de Filtros */}
        <section className="mb-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 flex flex-col md:flex-row gap-6 items-end justify-between">
          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">De</label>
              <input 
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Até</label>
              <input 
                type="date" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            {isAdmin && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Barbeiro</label>
                <select
                  value={barberId}
                  onChange={e => setBarberId(e.target.value)}
                  className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm text-white focus:border-green-500 focus:outline-none"
                >
                  <option value="">Todos os Barbeiros</option>
                  {barbers.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => setPreset('HOJE')} className="px-4 py-2 rounded-lg bg-neutral-800 text-xs font-bold text-neutral-300 hover:bg-neutral-700 transition-colors">Hoje</button>
            <button onClick={() => setPreset('SEMANA')} className="px-4 py-2 rounded-lg bg-neutral-800 text-xs font-bold text-neutral-300 hover:bg-neutral-700 transition-colors">Esta Semana</button>
            <button onClick={() => setPreset('MES')} className="px-4 py-2 rounded-lg bg-neutral-800 text-xs font-bold text-neutral-300 hover:bg-neutral-700 transition-colors">Este Mês</button>
          </div>
        </section>

        {/* Resumo */}
        <section className="grid gap-6 md:grid-cols-2 mb-8">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Valor Bruto no Período</h3>
              <p className="mt-1 text-4xl font-black tracking-tighter text-white">
                R$ {metrics?.totalRevenue.toFixed(2).replace('.', ',') || '0,00'}
              </p>
            </div>
            <div className="text-4xl">💎</div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-green-500">Comissões a Pagar/Receber</h3>
              <p className="mt-1 text-4xl font-black tracking-tighter text-green-500">
                R$ {metrics?.totalCommission.toFixed(2).replace('.', ',') || '0,00'}
              </p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Cortes Concluídos</h3>
              <p className="mt-1 text-4xl font-black tracking-tighter text-white">
                {metrics?.completedCount || 0}
              </p>
            </div>
            <div className="text-4xl">✂️</div>
          </div>
        </section>

        {/* Lista Detalhada */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4">Extrato Detalhado</h2>
          {loading ? (
             <div className="animate-pulse flex gap-2">
               <div className="h-16 bg-neutral-800 rounded-xl w-full"></div>
             </div>
          ) : !metrics || metrics.details.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-sm border border-dashed border-neutral-800 rounded-2xl">
              Nenhum atendimento finalizado neste período.
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.details.map(detail => (
                <div key={detail.id} className="flex flex-col md:flex-row md:items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 transition-colors hover:border-neutral-700">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 flex-shrink-0 rounded bg-green-500/10 flex items-center justify-center text-green-500 font-bold">
                      {format(new Date(detail.startTime), 'dd/MM')}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{detail.clientName}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-neutral-400">
                        <span>{detail.serviceName}</span>
                        {isAdmin && (
                           <>
                             <span className="text-neutral-600">•</span>
                             <span className="text-amber-500">{detail.barberName}</span>
                           </>
                        )}
                        <span className="text-neutral-600">•</span>
                        <span>{format(new Date(detail.startTime), "HH:mm")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0 text-right">
                    <span className="text-lg font-black text-white block">R$ {detail.price.toFixed(2).replace('.', ',')}</span>
                    <span className="text-xs font-bold text-green-500">Comissão: R$ {detail.commission.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

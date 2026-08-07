"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  client: { name: string; email: string };
  service: { name: string; durationMinutes: number; price: number };
}

interface Metrics {
  totalRevenue: number;
  completedCount: number;
  pendingCount: number;
}

export default function Dashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{title: string, desc: string, type?: 'error' | 'success'} | null>(null);
  
  // States para Bloqueio de Horário
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');
  const [blockReason, setBlockReason] = useState('');

  const router = useRouter();

  const showToast = (title: string, desc: string, type: 'error' | 'success' = 'error') => {
    setToastMessage({ title, desc, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    
    if (!token) {
      router.push('/login');
      return;
    }

    if (role === 'CLIENT') {
      router.push('/reservas');
      return;
    }

    try {
      // Fetch agenda e métricas em paralelo
      const [apptsRes, metricsRes] = await Promise.all([
        fetch('http://localhost:3333/appointments/me', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('http://localhost:3333/appointments/metrics/today', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!apptsRes.ok || !metricsRes.ok) {
        if (apptsRes.status === 401 || metricsRes.status === 401) {
          localStorage.removeItem('access_token');
          router.push('/login');
        }
        throw new Error('Falha ao buscar dados');
      }

      setAppointments(await apptsRes.json());
      setMetrics(await metricsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    router.push('/login');
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:3333/appointments/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        // Atualiza a tela recarregando os dados silenciosamente
        fetchDashboardData();
      } else {
        const errorData = await res.json();
        
        if (errorData.message === 'Não é possível concluir um agendamento antes do seu horário de início.') {
          showToast('Calma lá! ⏳', 'O agendamento ainda não começou. Aguarde o horário marcado para concluí-lo!');
        } else {
          showToast('Opa!', errorData.message || 'Falha ao atualizar o status do agendamento.');
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:3333/schedule-blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          startTime: new Date(blockStartTime).toISOString(),
          endTime: new Date(blockEndTime).toISOString(),
          reason: blockReason
        })
      });

      if (res.ok) {
        showToast('Sucesso!', 'Horário bloqueado com sucesso.', 'success');
        setIsBlockModalOpen(false);
        setBlockStartTime('');
        setBlockEndTime('');
        setBlockReason('');
      } else {
        const errorData = await res.json();
        showToast('Opa!', errorData.message || 'Falha ao bloquear horário.');
      }
    } catch (error) {
      console.error(error);
      showToast('Erro', 'Ocorreu um erro ao tentar bloquear a agenda.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-amber-500">
        <div className="animate-pulse font-bold text-xl tracking-widest uppercase">Carregando Agenda...</div>
      </div>
    );
  }

  const isAdmin = typeof window !== 'undefined' ? localStorage.getItem('is_admin') === 'true' : false;
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user_name') || 'Barbeiro' : 'Barbeiro';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5">
          <div className={`border rounded-2xl p-4 flex items-start gap-4 shadow-2xl backdrop-blur-md max-w-sm w-full ${toastMessage.type === 'success' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${toastMessage.type === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
              {toastMessage.type === 'success' ? '✅' : '⚠️'}
            </div>
            <div>
              <h3 className={`text-sm font-bold mb-1 ${toastMessage.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{toastMessage.title}</h3>
              <p className={`text-xs leading-relaxed ${toastMessage.type === 'success' ? 'text-green-400/90' : 'text-red-400/90'}`}>{toastMessage.desc}</p>
            </div>
            <button onClick={() => setToastMessage(null)} className={`ml-auto ${toastMessage.type === 'success' ? 'text-green-500/50 hover:text-green-500' : 'text-red-500/50 hover:text-red-500'}`}>
              ✕
            </button>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-neutral-950 font-black text-sm">
              GB
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Painel de Controle</h1>
              <span className="text-xs text-neutral-500">Área de {userName}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <>
                <button 
                  onClick={() => router.push('/dashboard/clientes')}
                  className="text-xs font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors"
                >
                  👥 Clientes
                </button>
                <button 
                  onClick={() => router.push('/dashboard/barbeiros')}
                  className="text-xs font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors"
                >
                  ✂️ Equipe
                </button>
                <button 
                  onClick={() => router.push('/dashboard/servicos')}
                  className="text-xs font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors"
                >
                  ⚙️ Serviços
                </button>
              </>
            )}
            <button 
              onClick={() => router.push('/dashboard/financeiro')}
              className="text-xs font-bold uppercase tracking-wider text-green-500 hover:text-green-400 transition-colors mr-2"
            >
              💰 Financeiro
            </button>
            <button 
              onClick={handleLogout}
              className="text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-red-400 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 md:py-12">
        {/* Painel de Métricas */}
        {metrics && (
          <section className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Faturamento Hoje</h3>
              <p className="text-3xl font-black text-amber-500 mt-2">R$ {metrics.totalRevenue.toFixed(2).replace('.', ',')}</p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Concluídos</h3>
              <p className="text-3xl font-black text-white mt-2">{metrics.completedCount}</p>
            </div>
            <div className="col-span-2 md:col-span-1 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Pendentes</h3>
              <p className="text-3xl font-black text-neutral-400 mt-2">{metrics.pendingCount}</p>
            </div>
          </section>
        )}

        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Sua Agenda</h2>
            <p className="text-neutral-400 mt-1">Visão geral dos seus atendimentos registrados.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setIsBlockModalOpen(true)}
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm text-neutral-300 font-bold hover:bg-neutral-800 transition-colors"
            >
              Bloquear Horário
            </button>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-2 text-sm text-neutral-300 font-medium">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </div>
          </div>
        </div>

        {appointments.length === 0 ? (
          <div className="rounded-3xl border border-neutral-800 border-dashed bg-neutral-900/20 p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800 text-neutral-500 text-2xl">
              📅
            </div>
            <h3 className="text-lg font-bold text-white">Nenhum agendamento</h3>
            <p className="text-sm text-neutral-400 mt-1">Sua agenda está livre por enquanto.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {appointments.map((appt) => {
              const start = new Date(appt.startTime);
              const isScheduled = appt.status === 'SCHEDULED';
              
              return (
                <div 
                  key={appt.id} 
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all p-5
                    ${isScheduled ? 'border-neutral-800 bg-neutral-900 hover:border-neutral-700 hover:bg-neutral-800/80 hover:shadow-xl' : 'border-neutral-800/50 bg-neutral-900/30 opacity-75'}
                  `}
                >
                  {isScheduled && <div className="absolute left-0 top-0 h-full w-1 bg-amber-500/80 group-hover:bg-amber-400 transition-colors" />}
                  {!isScheduled && appt.status === 'COMPLETED' && <div className="absolute left-0 top-0 h-full w-1 bg-green-500/50" />}
                  {!isScheduled && appt.status === 'CANCELLED' && <div className="absolute left-0 top-0 h-full w-1 bg-red-500/50" />}
                  
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ${isScheduled ? 'bg-neutral-800 text-amber-500 ring-amber-500/20' : 'bg-transparent text-neutral-500 ring-neutral-700'}`}>
                        {format(start, 'dd/MM')} às {format(start, 'HH:mm')}
                      </span>
                    </div>
                    {appt.status === 'COMPLETED' && (
                      <span className="text-xs font-semibold uppercase tracking-wider text-green-400 bg-green-400/10 px-2 py-1 rounded-md">Concluído</span>
                    )}
                    {appt.status === 'CANCELLED' && (
                      <span className="text-xs font-semibold uppercase tracking-wider text-red-400 bg-red-400/10 px-2 py-1 rounded-md">Cancelado</span>
                    )}
                  </div>

                  <div>
                    <h3 className={`text-lg font-bold mb-1 ${isScheduled ? 'text-white' : 'text-neutral-400'}`}>{appt.client.name}</h3>
                    <p className="text-xs text-neutral-500 mb-4">{appt.client.email}</p>
                    
                    <div className="rounded-xl bg-neutral-950 p-3 border border-neutral-800/50 mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-medium ${isScheduled ? 'text-neutral-300' : 'text-neutral-500'}`}>{appt.service.name}</span>
                        <span className={`text-sm font-bold ${isScheduled ? 'text-white' : 'text-neutral-500'}`}>R$ {appt.service.price}</span>
                      </div>
                      <div className="text-xs text-neutral-500">
                        Duração: {appt.service.durationMinutes} min
                      </div>
                    </div>

                    {isScheduled && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleUpdateStatus(appt.id, 'COMPLETED')}
                          className="flex-1 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-xs font-bold text-green-500 hover:bg-green-500 hover:text-white transition-colors"
                        >
                          Concluir
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(appt.id, 'CANCELLED')}
                          className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de Bloqueio de Horário */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Bloquear Horário</h2>
            <p className="text-sm text-neutral-400 mb-6">Defina um período em que você não estará disponível (ex: almoço, folga).</p>
            <form onSubmit={handleCreateBlock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Início</label>
                <input 
                  type="datetime-local" required
                  value={blockStartTime} onChange={e => setBlockStartTime(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Término</label>
                <input 
                  type="datetime-local" required
                  value={blockEndTime} onChange={e => setBlockEndTime(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Motivo (Opcional)</label>
                <input 
                  type="text" 
                  value={blockReason} onChange={e => setBlockReason(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                  placeholder="Ex: Horário de Almoço"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsBlockModalOpen(false)}
                  className="w-1/2 rounded-xl border border-neutral-700 bg-transparent px-4 py-3 text-sm font-bold text-neutral-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="w-1/2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-neutral-950 hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

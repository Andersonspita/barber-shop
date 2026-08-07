"use client";

import React, { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  service: { name: string; durationMinutes: number; price: number };
}

export default function MinhasReservas() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchAppointments = async () => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    
    if (!token || role !== 'CLIENT') {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/appointments/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('user_role');
          router.push('/login');
        }
        throw new Error('Falha ao buscar reservas');
      }

      setAppointments(await response.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [router]);

  const handleCancel = async (id: string) => {
    const confirmCancel = confirm("Tem certeza que deseja cancelar este agendamento?");
    if (!confirmCancel) return;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/appointments/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'CANCELLED' })
      });

      if (res.ok) {
        fetchAppointments();
      } else {
        alert('Falha ao cancelar o agendamento.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-amber-500">
        <div className="animate-pulse font-bold text-xl tracking-widest uppercase">Carregando Reservas...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans">
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-neutral-950 font-black text-sm">
              GB
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Portal do Cliente</h1>
              <span className="text-xs text-neutral-500">Minhas Reservas</span>
            </div>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="text-xs font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors"
          >
            Novo Agendamento
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 md:py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Suas Reservas</h2>
          <p className="text-neutral-400 mt-1">Acompanhe seus horários ou faça o cancelamento caso não possa comparecer.</p>
        </div>

        {appointments.length === 0 ? (
          <div className="rounded-3xl border border-neutral-800 border-dashed bg-neutral-900/20 p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800 text-neutral-500 text-2xl">
              ✂️
            </div>
            <h3 className="text-lg font-bold text-white">Nenhum agendamento encontrado</h3>
            <p className="text-sm text-neutral-400 mt-1">Você ainda não marcou nenhum horário.</p>
            <button 
              onClick={() => router.push('/')}
              className="mt-6 inline-flex items-center rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-neutral-950 transition-all hover:bg-amber-400 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            >
              Agendar Agora
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((appt) => {
              const start = new Date(appt.startTime);
              const isScheduled = appt.status === 'SCHEDULED';
              
              return (
                <div 
                  key={appt.id} 
                  className={`relative flex flex-col md:flex-row items-start md:items-center justify-between overflow-hidden rounded-2xl border p-5 transition-all
                    ${isScheduled ? 'border-neutral-800 bg-neutral-900 hover:border-neutral-700' : 'border-neutral-800/50 bg-neutral-900/30 opacity-75'}
                  `}
                >
                  {isScheduled && <div className="absolute left-0 top-0 h-full w-1 bg-amber-500/80" />}
                  {!isScheduled && appt.status === 'COMPLETED' && <div className="absolute left-0 top-0 h-full w-1 bg-green-500/50" />}
                  {!isScheduled && appt.status === 'CANCELLED' && <div className="absolute left-0 top-0 h-full w-1 bg-red-500/50" />}
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ${isScheduled ? 'bg-neutral-800 text-amber-500 ring-amber-500/20' : 'bg-transparent text-neutral-500 ring-neutral-700'}`}>
                        {format(start, 'dd/MM/yyyy')} às {format(start, 'HH:mm')}
                      </span>
                      {appt.status === 'COMPLETED' && (
                        <span className="text-xs font-semibold uppercase tracking-wider text-green-400 bg-green-400/10 px-2 py-1 rounded-md">Concluído</span>
                      )}
                      {appt.status === 'CANCELLED' && (
                        <span className="text-xs font-semibold uppercase tracking-wider text-red-400 bg-red-400/10 px-2 py-1 rounded-md">Cancelado</span>
                      )}
                    </div>
                    <h3 className={`text-xl font-bold ${isScheduled ? 'text-white' : 'text-neutral-400'}`}>{appt.service.name}</h3>
                    <p className="text-sm text-neutral-500 mt-1">Duração aprox: {appt.service.durationMinutes} min</p>
                  </div>

                  <div className="mt-4 md:mt-0 flex items-center gap-6 w-full md:w-auto">
                    <div className="text-left md:text-right">
                      <p className="text-xs text-neutral-500 uppercase font-semibold tracking-wider">Valor</p>
                      <p className={`text-xl font-black ${isScheduled ? 'text-white' : 'text-neutral-500'}`}>R$ {appt.service.price}</p>
                    </div>
                    
                    {isScheduled && (
                      <button 
                        onClick={() => handleCancel(appt.id)}
                        className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500 transition-colors hover:bg-red-500 hover:text-white"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <section className="mt-12 rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6 md:p-8">
          <h3 className="text-lg font-bold text-white mb-4">Segurança da Conta</h3>
          <p className="text-sm text-neutral-400 mb-6">Altere sua senha para manter sua conta segura.</p>
          
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              const target = e.target as typeof e.target & {
                current: { value: string };
                newpass: { value: string };
              };
              
              const token = localStorage.getItem('access_token');
              if (!token) return;

              try {
                const res = await fetch(`${API_URL}/auth/change-password`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                  },
                  body: JSON.stringify({
                    currentPass: target.current.value,
                    newPass: target.newpass.value
                  })
                });

                const data = await res.json();
                if (res.ok) {
                  alert('Senha alterada com sucesso!');
                  target.current.value = '';
                  target.newpass.value = '';
                } else {
                  alert(data.message || 'Falha ao alterar senha.');
                }
              } catch (err) {
                console.error(err);
                alert('Erro de comunicação.');
              }
            }}
            className="flex flex-col md:flex-row gap-4 items-end"
          >
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Senha Atual</label>
              <input 
                type="password" name="current" required
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Nova Senha</label>
              <input 
                type="password" name="newpass" required
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit"
              className="w-full md:w-auto px-6 py-3 rounded-xl bg-neutral-800 text-sm font-bold text-white hover:bg-neutral-700 transition-colors"
            >
              Atualizar Senha
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

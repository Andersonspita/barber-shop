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
      router.push('/login?role=cliente');
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
          router.push('/login?role=cliente');
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

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
    router.push('/login?role=cliente');
  };

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
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6 sm:py-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-neutral-950 font-black text-sm">
              GB
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Portal do Cliente</h1>
              <span className="text-xs text-neutral-500">Minhas Reservas</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:flex-nowrap sm:justify-end">
            <button
              onClick={() => router.push('/reservas/nova')}
              className="text-xs font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors"
            >
              Novo Agendamento
            </button>
            <button
              onClick={() => router.push('/reservas/configuracoes')}
              className="text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors"
            >
              ⚙️ Configurações
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
              onClick={() => router.push('/reservas/nova')}
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
      </main>
    </div>
  );
}

"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addDays } from 'date-fns';

interface TimeSlot {
  time: string;
  available: boolean;
  dateTime: string;
}

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}

interface Barber {
  id: string;
  name: string;
}

function NovoAgendamentoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedServiceId = searchParams.get('serviceId');

  const [checkingAuth, setCheckingAuth] = useState(true);

  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState('');

  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barberId, setBarberId] = useState('');

  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [message, setMessage] = useState('');

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    if (!token || role !== 'CLIENT') {
      router.push('/login?role=cliente');
      return;
    }
    setCheckingAuth(false);
  }, [router]);

  useEffect(() => {
    if (checkingAuth) return;
    Promise.all([
      fetch(`${API_URL}/services`).then(res => res.json()),
      fetch(`${API_URL}/barbers`).then(res => res.json())
    ])
      .then(([servicesData, barbersData]) => {
        setServices(Array.isArray(servicesData) ? servicesData : []);
        if (Array.isArray(servicesData) && servicesData.length > 0) {
          const preselected = preselectedServiceId && servicesData.some((s: Service) => s.id === preselectedServiceId);
          setServiceId(preselected ? preselectedServiceId! : servicesData[0].id);
        }
        setBarbers(Array.isArray(barbersData) ? barbersData : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching data', err);
        setLoading(false);
      });
  }, [checkingAuth]);

  useEffect(() => {
    if (!serviceId) return;

    const fetchAvailability = async () => {
      setSlotsLoading(true);
      setSelectedTimeSlot(null);
      try {
        let url = `${API_URL}/appointments/availability?date=${selectedDate}&serviceId=${serviceId}`;
        if (barberId) url += `&barberId=${barberId}`;

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setAvailableSlots(data);
        }
      } catch (error) {
        console.error('Falha ao buscar horários:', error);
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchAvailability();
  }, [selectedDate, serviceId, barberId]);

  const handleBook = async () => {
    if (!selectedTimeSlot) return;

    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login?role=cliente');
      return;
    }

    setBooking(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/appointments/dynamic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          serviceId,
          startTime: selectedTimeSlot.dateTime,
          barberId: barberId || undefined
        })
      });

      const result = await response.json();

      if (response.ok) {
        setMessage('🎉 ' + result.message);
        setAvailableSlots(prev => prev.filter(s => s.time !== selectedTimeSlot.time));
        setSelectedTimeSlot(null);
      } else {
        setMessage('❌ ' + result.message);
      }
    } catch (err) {
      setMessage('❌ Falha de comunicação com o servidor.');
    } finally {
      setBooking(false);
    }
  };

  if (checkingAuth) {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans">
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6 sm:py-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-neutral-950 font-black text-sm">
              GB
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Portal do Cliente</h1>
              <span className="text-xs text-neutral-500">Novo Agendamento</span>
            </div>
          </div>
          <button
            onClick={() => router.push('/reservas')}
            className="text-xs font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors"
          >
            Minhas Reservas
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 md:py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Reserve sua Cadeira</h2>
          <p className="text-neutral-400 mt-1">Em poucos passos, seu horário estará garantido.</p>
        </div>

        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-6 md:p-10 shadow-2xl">
          <div className="grid gap-12 lg:grid-cols-[1fr_350px]">

            {/* Esquerda: Escolhas */}
            <div className="space-y-10">
              {/* 1. Serviço */}
              <div>
                <h3 className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-neutral-300 mb-5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-neutral-950 text-xs">1</span>
                  Serviço
                </h3>
                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-neutral-900 animate-pulse rounded-2xl border border-neutral-800"></div>)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {services.map(svc => (
                      <button
                        key={svc.id}
                        onClick={() => setServiceId(svc.id)}
                        className={`text-left p-4 rounded-2xl border transition-all ${serviceId === svc.id ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-600'}`}
                      >
                        <div className="font-bold text-white mb-1 truncate">{svc.name}</div>
                        <div className="text-amber-500 text-sm font-semibold">R$ {Number(svc.price).toFixed(2)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Barbeiro & Data */}
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-neutral-300 mb-5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-neutral-950 text-xs">2</span>
                    Profissional
                  </h3>
                  <select
                    value={barberId}
                    onChange={(e) => setBarberId(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-4 text-sm font-semibold text-white focus:border-amber-500 focus:outline-none transition-all cursor-pointer appearance-none"
                  >
                    <option value="">Qualquer (Mais rápido)</option>
                    {barbers.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <h3 className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-neutral-300 mb-5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-neutral-950 text-xs">3</span>
                    Data
                  </h3>
                  <input
                    type="date"
                    value={selectedDate}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-4 text-sm font-semibold text-white focus:border-amber-500 focus:outline-none transition-all custom-calendar-icon"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>
            </div>

            {/* Direita: Horários e CTA */}
            <div className="bg-neutral-950 rounded-3xl p-6 border border-neutral-800 flex flex-col h-full">
              <h3 className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-neutral-300 mb-5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-neutral-950 text-xs">4</span>
                Horário
              </h3>

              <div className="flex-1 min-h-[250px]">
                {slotsLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-amber-500 font-bold animate-pulse">
                    Buscando agenda...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-neutral-500 text-center px-4">
                    Tudo lotado para este dia.<br />Selecione outra data.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedTimeSlot?.time === slot.time;
                      return (
                        <button
                          key={slot.time}
                          disabled={!slot.available || loading}
                          onClick={() => setSelectedTimeSlot(slot)}
                          className={`
                            flex items-center justify-center rounded-xl py-3 text-sm font-bold transition-all
                            ${!slot.available ? 'bg-neutral-900 text-neutral-800 cursor-not-allowed' : ''}
                            ${slot.available && !isSelected ? 'border border-neutral-800 bg-neutral-900/50 text-white hover:border-amber-500 hover:bg-amber-500/10 hover:text-amber-400' : ''}
                            ${isSelected ? 'border-2 border-amber-500 bg-amber-500 text-neutral-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : ''}
                          `}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-6 mt-4 border-t border-neutral-900">
                <button
                  onClick={handleBook}
                  disabled={loading || booking || !selectedTimeSlot || slotsLoading}
                  className="w-full rounded-2xl bg-white px-4 py-4 text-[15px] font-black text-neutral-950 transition-all hover:bg-neutral-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex justify-center items-center gap-2"
                >
                  {booking ? 'Aguarde...' : selectedTimeSlot ? `Confirmar ${selectedTimeSlot.time}` : 'Escolha um horário'}
                </button>
                {message && (
                  <div className="mt-4 text-center text-sm font-bold text-amber-500">
                    {message}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-calendar-icon::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
      `}} />
    </div>
  );
}

export default function NovoAgendamento() {
  return (
    <Suspense fallback={null}>
      <NovoAgendamentoForm />
    </Suspense>
  );
}

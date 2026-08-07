"use client";

import React, { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export default function LandingPage() {
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
    Promise.all([
      fetch('http://localhost:3333/services').then(res => res.json()),
      fetch('http://localhost:3333/barbers').then(res => res.json())
    ])
      .then(([servicesData, barbersData]) => {
        setServices(Array.isArray(servicesData) ? servicesData : []);
        if (Array.isArray(servicesData) && servicesData.length > 0) {
          setServiceId(servicesData[0].id);
        }
        setBarbers(Array.isArray(barbersData) ? barbersData : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching data', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!serviceId) return;

    const fetchAvailability = async () => {
      setSlotsLoading(true);
      setSelectedTimeSlot(null);
      try {
        let url = `http://localhost:3333/appointments/availability?date=${selectedDate}&serviceId=${serviceId}`;
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
    const role = localStorage.getItem('user_role');
    
    if (!token || role !== 'CLIENT') {
      window.location.href = '/login';
      return;
    }

    setBooking(true);
    setMessage('');
    
    try {
      const response = await fetch('http://localhost:3333/appointments/dynamic', {
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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-amber-500/30 scroll-smooth">
      {/* HEADER */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-neutral-950/60 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-neutral-950 font-black text-lg shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              GB
            </div>
            <span className="text-xl font-bold tracking-tight text-white hidden sm:block">Gerente Barber</span>
          </div>
          <nav className="hidden md:flex gap-8">
            <a href="#inicio" className="text-sm font-semibold text-neutral-400 hover:text-white transition-colors">Início</a>
            <a href="#servicos" className="text-sm font-semibold text-neutral-400 hover:text-white transition-colors">Serviços</a>
            <a href="#equipe" className="text-sm font-semibold text-neutral-400 hover:text-white transition-colors">Equipe</a>
            <a href="#agendar" className="text-sm font-semibold text-amber-500 hover:text-amber-400 transition-colors">Agendar</a>
          </nav>
          <div className="flex gap-4 items-center">
            <button onClick={() => window.location.href='/reservas'} className="text-sm font-semibold text-neutral-400 hover:text-white transition-colors">
              Reservas
            </button>
            <button onClick={() => window.location.href='/login'} className="text-sm font-bold text-neutral-950 bg-white px-5 py-2.5 rounded-xl hover:bg-neutral-200 transition-colors">
              Entrar
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section id="inicio" className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden flex items-center justify-center min-h-[90vh]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-900/20 via-neutral-950 to-neutral-950"></div>
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-amber-500/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-[30rem] h-[30rem] bg-amber-700/10 blur-[150px] rounded-full mix-blend-screen pointer-events-none"></div>
        
        <div className="mx-auto max-w-5xl px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs font-bold uppercase tracking-widest mb-6">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Experiência Premium
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-[1.1]">
            Eleve seu estilo a um <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">novo patamar.</span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Mais que um corte, um ritual de cuidado. Conecte-se com os melhores profissionais da cidade e agende seu horário em segundos, sem complicação.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#agendar" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(245,158,11,0.4)]">
              Agendar Agora
            </a>
            <a href="#servicos" className="w-full sm:w-auto px-8 py-4 rounded-2xl border border-neutral-700 bg-neutral-900/50 text-white font-bold text-lg hover:bg-neutral-800 transition-all">
              Ver Serviços
            </a>
          </div>
        </div>
      </section>

      {/* SERVICES SECTION */}
      <section id="servicos" className="py-24 bg-neutral-950 border-t border-neutral-900">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">Serviços de Excelência</h2>
            <p className="text-neutral-400">Escolha o serviço perfeito para o seu estilo.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-40 bg-neutral-900 animate-pulse rounded-3xl border border-neutral-800"></div>)
            ) : (
              services.map(svc => (
                <div key={svc.id} className="group p-8 rounded-3xl border border-neutral-800 bg-neutral-900/30 hover:bg-neutral-900 hover:border-amber-500/50 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-white group-hover:text-amber-500 transition-colors">{svc.name}</h3>
                    <span className="text-xl font-black text-amber-500">R$ {Number(svc.price).toFixed(0)}</span>
                  </div>
                  <p className="text-neutral-500 text-sm mb-6">Tratamento completo com duração aproximada de {svc.durationMinutes} minutos, incluindo lavagem e finalização premium.</p>
                  <button onClick={() => { setServiceId(svc.id); window.location.href='#agendar'; }} className="w-full py-3 rounded-xl border border-neutral-700 text-sm font-bold text-white group-hover:border-amber-500 group-hover:text-amber-500 transition-colors">
                    Escolher
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* TEAM SECTION */}
      <section id="equipe" className="py-24 relative">
        <div className="absolute inset-0 bg-neutral-900/30"></div>
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div>
              <h2 className="text-3xl md:text-5xl font-black text-white mb-4">Nossa Equipe</h2>
              <p className="text-neutral-400 max-w-md">Profissionais apaixonados pelo que fazem, prontos para entregar o melhor resultado para você.</p>
            </div>
          </div>
          
          <div className="flex overflow-x-auto pb-8 gap-6 custom-scrollbar snap-x">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="min-w-[280px] h-[350px] bg-neutral-900 animate-pulse rounded-3xl border border-neutral-800 shrink-0"></div>)
            ) : (
              barbers.map((b, idx) => (
                <div key={b.id} className="snap-start shrink-0 w-[280px] md:w-[320px] rounded-3xl overflow-hidden group relative">
                  {/* Fake Image Placeholder */}
                  <div className="h-[400px] w-full bg-neutral-800 relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent z-10"></div>
                    <img src={`https://i.pravatar.cc/400?img=${11 + idx}`} alt={b.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity grayscale group-hover:grayscale-0 duration-500" />
                  </div>
                  <div className="absolute bottom-0 left-0 w-full p-6 z-20">
                    <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Master Barber</p>
                    <h3 className="text-2xl font-black text-white">{b.name}</h3>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* BOOKING SECTION */}
      <section id="agendar" className="py-24 bg-neutral-950">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">Reserve sua Cadeira</h2>
            <p className="text-neutral-400">Em poucos passos, seu horário estará garantido.</p>
          </div>

          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-6 md:p-10 shadow-2xl backdrop-blur-xl">
            <div className="grid gap-12 lg:grid-cols-[1fr_350px]">
              
              {/* Esquerda: Escolhas */}
              <div className="space-y-10">
                {/* 1. Serviço */}
                <div>
                  <h3 className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-neutral-300 mb-5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-neutral-950 text-xs">1</span>
                    Serviço
                  </h3>
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
                      Tudo lotado para este dia.<br/>Selecione outra data.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
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
        </div>
      </section>

      <footer className="border-t border-neutral-900 bg-neutral-950 py-10 text-center">
        <p className="text-sm font-semibold text-neutral-600">© 2026 Gerente Barber. Todos os direitos reservados.</p>
      </footer>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #333; border-radius: 10px; }
        .custom-calendar-icon::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
        html { scroll-behavior: smooth; }
      `}} />
    </div>
  );
}

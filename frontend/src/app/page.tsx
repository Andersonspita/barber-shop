"use client";

import React, { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';

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
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/services`).then(res => res.json()),
      fetch(`${API_URL}/barbers`).then(res => res.json())
    ])
      .then(([servicesData, barbersData]) => {
        setServices(Array.isArray(servicesData) ? servicesData : []);
        setBarbers(Array.isArray(barbersData) ? barbersData : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching data', err);
        setLoading(false);
      });
  }, []);

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
          </nav>
          <div className="flex gap-4 items-center">
            <a href="/reservas" className="text-sm font-semibold text-neutral-400 hover:text-white transition-colors">
              Reservas
            </a>
            <a href="/login?role=cliente" className="text-sm font-bold text-neutral-950 bg-white px-5 py-2.5 rounded-xl hover:bg-neutral-200 transition-colors">
              Entrar
            </a>
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
            <a href="/reservas/nova" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(245,158,11,0.4)]">
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
              [1, 2, 3].map(i => <div key={i} className="h-40 bg-neutral-900 animate-pulse rounded-3xl border border-neutral-800"></div>)
            ) : (
              services.map(svc => (
                <div key={svc.id} className="group p-8 rounded-3xl border border-neutral-800 bg-neutral-900/30 hover:bg-neutral-900 hover:border-amber-500/50 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-white group-hover:text-amber-500 transition-colors">{svc.name}</h3>
                    <span className="text-xl font-black text-amber-500">R$ {Number(svc.price).toFixed(0)}</span>
                  </div>
                  <p className="text-neutral-500 text-sm mb-6">Tratamento completo com duração aproximada de {svc.durationMinutes} minutos, incluindo lavagem e finalização premium.</p>
                  <a href={`/reservas/nova?serviceId=${svc.id}`} className="block w-full py-3 rounded-xl border border-neutral-700 text-sm font-bold text-white text-center group-hover:border-amber-500 group-hover:text-amber-500 transition-colors">
                    Escolher
                  </a>
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
              [1, 2, 3].map(i => <div key={i} className="min-w-[280px] h-[350px] bg-neutral-900 animate-pulse rounded-3xl border border-neutral-800 shrink-0"></div>)
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

      <footer className="border-t border-neutral-900 bg-neutral-950 py-10 text-center">
        <p className="text-sm font-semibold text-neutral-600">© 2026 Gerente Barber. Todos os direitos reservados.</p>
        <a href="/login?role=barbeiro" className="mt-3 inline-block text-xs font-medium text-neutral-700 hover:text-neutral-400 transition-colors">
          Área do Profissional
        </a>
      </footer>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #333; border-radius: 10px; }
        html { scroll-behavior: smooth; }
      `}} />
    </div>
  );
}

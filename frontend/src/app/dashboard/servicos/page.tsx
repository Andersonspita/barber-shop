"use client";

import React, { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  price: string | number;
}

export default function GerenciarServicos() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States for the form
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [price, setPrice] = useState('');

  const router = useRouter();

  const fetchServices = async () => {
    const token = localStorage.getItem('access_token');
    const isAdmin = localStorage.getItem('is_admin') === 'true';

    if (!token || !isAdmin) {
      router.push('/dashboard');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/admin/services`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setServices(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [router]);

  const resetForm = () => {
    setIsEditing(false);
    setCurrentId('');
    setName('');
    setDurationMinutes(30);
    setPrice('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    
    const url = isEditing 
      ? `${API_URL}/admin/services/${currentId}` 
      : `${API_URL}/admin/services`;
    
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          durationMinutes: Number(durationMinutes),
          price: Number(price)
        })
      });

      if (res.ok) {
        fetchServices();
        resetForm();
      } else {
        alert('Erro ao salvar o serviço.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (svc: Service) => {
    setIsEditing(true);
    setCurrentId(svc.id);
    setName(svc.name);
    setDurationMinutes(svc.durationMinutes);
    setPrice(Number(svc.price).toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este serviço? Histórico de agendamentos pode ser afetado.')) return;
    
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${API_URL}/admin/services/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchServices();
      } else {
        alert('Falha ao excluir.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-amber-500">
        <div className="animate-pulse font-bold tracking-widest uppercase">Carregando...</div>
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
              <h1 className="text-sm font-bold text-white leading-none">Gestão de Serviços</h1>
              <span className="text-xs text-neutral-500">Administrador</span>
            </div>
          </div>
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-amber-500 transition-colors"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        
        {/* Formulário de Criação/Edição */}
        <section className="mb-10 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
          <h2 className="text-xl font-bold text-white mb-6">
            {isEditing ? 'Editar Serviço' : 'Novo Serviço'}
          </h2>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Nome do Serviço</label>
              <input 
                type="text" required
                value={name} onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="Ex: Corte Degradê"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Duração (min)</label>
              <input 
                type="number" required min="10" step="5"
                value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Preço (R$)</label>
              <input 
                type="number" required min="0" step="0.01"
                value={price} onChange={e => setPrice(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="0.00"
              />
            </div>
            <div className="md:col-span-4 flex gap-3 justify-end mt-2">
              {isEditing && (
                <button type="button" onClick={resetForm} className="px-6 py-3 rounded-xl border border-neutral-700 text-sm font-bold text-neutral-400 hover:text-white transition-colors">
                  Cancelar
                </button>
              )}
              <button type="submit" className="px-6 py-3 rounded-xl bg-amber-500 text-sm font-bold text-neutral-950 hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                {isEditing ? 'Salvar Alterações' : 'Adicionar Serviço'}
              </button>
            </div>
          </form>
        </section>

        {/* Lista de Serviços */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4">Serviços Cadastrados</h2>
          <div className="space-y-3">
            {services.map(svc => (
              <div key={svc.id} className="flex flex-col md:flex-row md:items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 transition-colors hover:border-neutral-700">
                <div>
                  <h3 className="text-lg font-bold text-white">{svc.name}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm text-amber-500 font-semibold">R$ {Number(svc.price).toFixed(2).replace('.',',')}</span>
                    <span className="text-xs text-neutral-500">•</span>
                    <span className="text-sm text-neutral-400">{svc.durationMinutes} minutos</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 md:mt-0">
                  <button 
                    onClick={() => handleEdit(svc)}
                    className="px-4 py-2 rounded-lg bg-neutral-800 text-xs font-bold text-white hover:bg-neutral-700 transition-colors"
                  >
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDelete(svc.id)}
                    className="px-4 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {services.length === 0 && (
              <div className="text-center py-10 text-neutral-500 text-sm border border-dashed border-neutral-800 rounded-xl">
                Nenhum serviço cadastrado.
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

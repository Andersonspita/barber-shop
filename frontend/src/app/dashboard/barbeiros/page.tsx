"use client";

import React, { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Barber {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  isAdmin: boolean;
  commissionRate: string | number;
  createdAt: string;
}

export default function GerenciarBarbeiros() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // States for the form
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [commissionRate, setCommissionRate] = useState('0.50');

  const router = useRouter();

  const fetchBarbers = async () => {
    const token = localStorage.getItem('access_token');
    const userIsAdmin = localStorage.getItem('is_admin') === 'true';

    if (!token || !userIsAdmin) {
      router.push('/dashboard');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/admin/barbers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setBarbers(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBarbers();
  }, [router]);

  const resetForm = () => {
    setIsEditing(false);
    setCurrentId('');
    setName('');
    setEmail('');
    setPhoneNumber('');
    setIsAdmin(false);
    setCommissionRate('0.50');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    
    const url = isEditing 
      ? `${API_URL}/admin/barbers/${currentId}` 
      : `${API_URL}/admin/barbers`;
    
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
          email,
          phoneNumber: phoneNumber || undefined,
          isAdmin,
          commissionRate: parseFloat(commissionRate)
        })
      });

      if (res.ok) {
        fetchBarbers();
        resetForm();
      } else {
        const error = await res.json();
        alert(error.message || 'Erro ao salvar o barbeiro.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (b: Barber) => {
    setIsEditing(true);
    setCurrentId(b.id);
    setName(b.name);
    setEmail(b.email);
    setPhoneNumber(b.phoneNumber || '');
    setIsAdmin(b.isAdmin);
    setCommissionRate(b.commissionRate ? String(b.commissionRate) : '0.50');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este barbeiro? Agendamentos atrelados a ele poderão ser removidos.')) return;
    
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${API_URL}/admin/barbers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchBarbers();
      } else {
        alert('Falha ao excluir.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredBarbers = barbers.filter(b => 
    b.name.toLowerCase().includes(search.toLowerCase()) || 
    b.email.toLowerCase().includes(search.toLowerCase())
  );

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
              <h1 className="text-sm font-bold text-white leading-none">Gestão de Equipe</h1>
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
          <h2 className="text-xl font-bold text-white mb-2">
            {isEditing ? 'Editar Barbeiro' : 'Novo Barbeiro da Equipe'}
          </h2>
          {!isEditing && (
             <p className="text-sm text-neutral-400 mb-6">
               A senha padrão para novos cadastros é <code className="bg-neutral-800 px-1 py-0.5 rounded text-amber-400">Mudar@123</code>.
             </p>
          )}
          
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 items-end">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Nome</label>
              <input 
                type="text" required
                value={name} onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="Ex: João da Silva"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">E-mail</label>
              <input 
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="joao@barbearia.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Telefone (Opcional)</label>
              <input 
                type="text"
                value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Comissão (ex: 0.50 = 50%)</label>
              <input 
                type="number" step="0.01" min="0" max="1" required
                value={commissionRate} onChange={e => setCommissionRate(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="0.50"
              />
            </div>
            <div className="flex items-center h-full pb-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isAdmin}
                  onChange={e => setIsAdmin(e.target.checked)}
                  className="w-5 h-5 rounded border-neutral-700 bg-neutral-950 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm font-semibold text-white">É Administrador do Sistema?</span>
              </label>
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end mt-2">
              {isEditing && (
                <button type="button" onClick={resetForm} className="px-6 py-3 rounded-xl border border-neutral-700 text-sm font-bold text-neutral-400 hover:text-white transition-colors">
                  Cancelar
                </button>
              )}
              <button type="submit" className="px-6 py-3 rounded-xl bg-amber-500 text-sm font-bold text-neutral-950 hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                {isEditing ? 'Salvar Alterações' : 'Cadastrar Profissional'}
              </button>
            </div>
          </form>
        </section>

        {/* Lista de Barbeiros */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
            <h2 className="text-xl font-bold text-white">Equipe de Barbeiros</h2>
            <input 
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full md:w-64 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="space-y-3">
            {filteredBarbers.map(b => (
              <div key={b.id} className="flex flex-col md:flex-row md:items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 transition-colors hover:border-neutral-700">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{b.name}</h3>
                    {b.isAdmin && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-950 bg-amber-500 px-2 py-0.5 rounded-sm">Admin</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm text-neutral-400">{b.email}</span>
                    {b.phoneNumber && (
                      <>
                        <span className="text-xs text-neutral-500">•</span>
                        <span className="text-sm text-neutral-400">{b.phoneNumber}</span>
                      </>
                    )}
                    <span className="text-xs text-neutral-500">•</span>
                    <span className="text-sm font-semibold text-green-500">
                      {b.commissionRate ? `${(Number(b.commissionRate) * 100).toFixed(0)}% Comissão` : '50% Comissão'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 md:mt-0">
                  <button 
                    onClick={() => handleEdit(b)}
                    className="px-4 py-2 rounded-lg bg-neutral-800 text-xs font-bold text-white hover:bg-neutral-700 transition-colors"
                  >
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDelete(b.id)}
                    className="px-4 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {filteredBarbers.length === 0 && (
              <div className="text-center py-10 text-neutral-500 text-sm border border-dashed border-neutral-800 rounded-xl">
                Nenhum barbeiro encontrado.
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

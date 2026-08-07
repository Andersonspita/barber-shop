"use client";

import React, { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Client {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  birthDate?: string | null;
  createdAt: string;
}

export default function GerenciarClientes() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // States for the form
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');

  // States for History Modal
  const [selectedClientHistory, setSelectedClientHistory] = useState<any>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const router = useRouter();

  const fetchClients = async () => {
    const token = localStorage.getItem('access_token');
    const isAdmin = localStorage.getItem('is_admin') === 'true';

    if (!token || !isAdmin) {
      router.push('/dashboard');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/admin/clients`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setClients(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [router]);

  const resetForm = () => {
    setIsEditing(false);
    setCurrentId('');
    setName('');
    setEmail('');
    setPhoneNumber('');
    setBirthDate('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    
    const url = isEditing 
      ? `${API_URL}/admin/clients/${currentId}` 
      : `${API_URL}/admin/clients`;
    
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
          birthDate: birthDate || undefined
        })
      });

      if (res.ok) {
        fetchClients();
        resetForm();
      } else {
        const error = await res.json();
        alert(error.message || 'Erro ao salvar o cliente.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (c: Client) => {
    setIsEditing(true);
    setCurrentId(c.id);
    setName(c.name);
    setEmail(c.email);
    setPhoneNumber(c.phoneNumber || '');
    setBirthDate(c.birthDate ? c.birthDate.split('T')[0] : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este cliente? Agendamentos atrelados a ele poderão ser removidos.')) return;
    
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${API_URL}/admin/clients/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchClients();
      } else {
        alert('Falha ao excluir.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewHistory = async (id: string) => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    setLoadingHistory(true);
    setIsHistoryModalOpen(true);
    
    try {
      const res = await fetch(`${API_URL}/admin/clients/${id}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedClientHistory(await res.json());
      } else {
        alert('Falha ao buscar histórico.');
        setIsHistoryModalOpen(false);
      }
    } catch (err) {
      console.error(err);
      setIsHistoryModalOpen(false);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
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
              <h1 className="text-sm font-bold text-white leading-none">Gestão de Clientes</h1>
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
            {isEditing ? 'Editar Cliente' : 'Novo Cliente (Walk-in)'}
          </h2>
          {!isEditing && (
             <p className="text-sm text-neutral-400 mb-6">
               A senha padrão para novos cadastros é <code className="bg-neutral-800 px-1 py-0.5 rounded text-amber-400">Mudar@123</code>.
             </p>
          )}
          
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3 items-end">
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
                placeholder="joao@email.com"
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Data de Nascimento (Opcional)</label>
              <input 
                type="date"
                value={birthDate} onChange={e => setBirthDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-3 flex gap-3 justify-end mt-2">
              {isEditing && (
                <button type="button" onClick={resetForm} className="px-6 py-3 rounded-xl border border-neutral-700 text-sm font-bold text-neutral-400 hover:text-white transition-colors">
                  Cancelar
                </button>
              )}
              <button type="submit" className="px-6 py-3 rounded-xl bg-amber-500 text-sm font-bold text-neutral-950 hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                {isEditing ? 'Salvar Alterações' : 'Cadastrar Cliente'}
              </button>
            </div>
          </form>
        </section>

        {/* Lista de Clientes */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
            <h2 className="text-xl font-bold text-white">Clientes Cadastrados</h2>
            <input 
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full md:w-64 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="space-y-3">
            {filteredClients.map(c => (
              <div key={c.id} className="flex flex-col md:flex-row md:items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 transition-colors hover:border-neutral-700">
                <div>
                  <h3 className="text-lg font-bold text-white">{c.name}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm text-neutral-400">{c.email}</span>
                    {c.phoneNumber && (
                      <>
                        <span className="text-xs text-neutral-500">•</span>
                        <span className="text-sm text-neutral-400">{c.phoneNumber}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-4 md:mt-0">
                  <button 
                    onClick={() => handleViewHistory(c.id)}
                    className="px-4 py-2 rounded-lg bg-green-500 text-xs font-bold text-neutral-950 hover:bg-green-400 transition-colors shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                  >
                    Ver Perfil
                  </button>
                  <button 
                    onClick={() => handleEdit(c)}
                    className="px-4 py-2 rounded-lg bg-neutral-800 text-xs font-bold text-white hover:bg-neutral-700 transition-colors"
                  >
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDelete(c.id)}
                    className="px-4 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {filteredClients.length === 0 && (
              <div className="text-center py-10 text-neutral-500 text-sm border border-dashed border-neutral-800 rounded-xl">
                Nenhum cliente encontrado.
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Modal de Histórico */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Perfil do Cliente</h2>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-neutral-500 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            
            {loadingHistory || !selectedClientHistory ? (
              <div className="flex-1 flex items-center justify-center min-h-[300px]">
                <div className="animate-pulse text-amber-500 font-bold uppercase tracking-widest">Carregando Histórico...</div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                
                {/* Header Profile */}
                <div className="flex items-center gap-4 bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800">
                  <div className="h-14 w-14 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center text-xl font-black">
                    {selectedClientHistory.client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedClientHistory.client.name}</h3>
                    <p className="text-sm text-neutral-400">{selectedClientHistory.client.email} • {selectedClientHistory.client.phoneNumber || 'Sem telefone'}</p>
                  </div>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800 text-center">
                    <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Valor Gasto</p>
                    <p className="text-2xl font-black text-green-500 mt-1">R$ {selectedClientHistory.metrics.totalSpent.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <div className="bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800 text-center">
                    <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Concluídos</p>
                    <p className="text-2xl font-black text-white mt-1">{selectedClientHistory.metrics.completedCount}</p>
                  </div>
                  <div className="bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800 text-center">
                    <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide">No Shows/Canc.</p>
                    <p className="text-2xl font-black text-red-500 mt-1">{selectedClientHistory.metrics.noShowCount}</p>
                  </div>
                </div>

                {/* Histórico Lista */}
                <div>
                  <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3">Histórico de Cortes ({selectedClientHistory.metrics.totalAppointments})</h4>
                  <div className="space-y-3">
                    {selectedClientHistory.history.map((h: any) => (
                      <div key={h.id} className="flex justify-between items-center p-4 bg-neutral-900/30 rounded-xl border border-neutral-800">
                        <div>
                          <p className="font-bold text-white">{h.service}</p>
                          <p className="text-xs text-neutral-400 mt-1">{new Date(h.date).toLocaleString('pt-BR')} • {h.barber}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-500">R$ {h.price.toFixed(2).replace('.', ',')}</p>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 inline-block ${
                            h.status === 'COMPLETED' ? 'bg-green-500/20 text-green-500' :
                            h.status === 'SCHEDULED' ? 'bg-amber-500/20 text-amber-500' :
                            'bg-red-500/20 text-red-500'
                          }`}>
                            {h.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    {selectedClientHistory.history.length === 0 && (
                      <p className="text-center text-neutral-500 py-4 text-sm">Nenhum atendimento registrado.</p>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function ConfiguracoesCliente() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    if (!token || role !== 'CLIENT') {
      router.push('/login?role=cliente');
      return;
    }
    setCheckingAuth(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
    router.push('/login?role=cliente');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as typeof e.target & {
      current: { value: string };
      newpass: { value: string };
    };

    const token = localStorage.getItem('access_token');
    if (!token) return;

    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth) {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans">
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6 sm:py-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-neutral-950 font-black text-sm">
              GB
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Portal do Cliente</h1>
              <span className="text-xs text-neutral-500">Configurações</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:flex-nowrap sm:justify-end">
            <button
              onClick={() => router.push('/reservas')}
              className="text-xs font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors"
            >
              Minhas Reservas
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

      <main className="mx-auto max-w-2xl px-6 py-8 md:py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Configurações</h2>
          <p className="text-neutral-400 mt-1">Gerencie a segurança da sua conta.</p>
        </div>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6 md:p-8">
          <h3 className="text-lg font-bold text-white mb-4">Alterar Senha</h3>
          <p className="text-sm text-neutral-400 mb-6">Defina uma nova senha para manter sua conta segura.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Senha Atual</label>
              <input
                type="password" name="current" required
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Nova Senha</label>
              <input
                type="password" name="newpass" required
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 text-sm font-bold text-neutral-950 hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? 'Aguarde...' : 'Atualizar Senha'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

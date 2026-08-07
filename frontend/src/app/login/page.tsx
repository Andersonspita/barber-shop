"use client";

import React, { Suspense, useState } from 'react';
import { API_URL } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const searchParams = useSearchParams();
  const role: 'BARBER' | 'CLIENT' = searchParams.get('role') === 'barbeiro' ? 'BARBER' : 'CLIENT';

  const [tab, setTab] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = tab === 'LOGIN' ? '/auth/login' : '/auth/signup';

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          pass: password,
          ...(tab === 'SIGNUP' && { birthDate: birthDate || undefined })
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (tab === 'SIGNUP') {
          alert('Cadastro realizado com sucesso! Faça login.');
          setTab('LOGIN');
        } else {
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('user_role', data.user.role);
          localStorage.setItem('is_admin', data.user.isAdmin);
          localStorage.setItem('user_name', data.user.name);

          if (data.user.role === 'BARBER') {
            router.push('/dashboard');
          } else {
            router.push('/reservas');
          }
        }
      } else {
        setError(data.message || 'Falha na autenticação.');
      }
    } catch (err) {
      setError('Erro de comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-200 font-sans p-6 selection:bg-amber-500/30">
      <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900/50 p-8 shadow-2xl backdrop-blur-md">

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            <span className="text-2xl font-black text-neutral-950">GB</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Gerente Barber</h1>
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-500">
            {role === 'BARBER' ? 'Área do Profissional' : 'Portal do Cliente'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {tab === 'SIGNUP' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Seu Nome</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                placeholder="Ex: João Silva"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          {tab === 'SIGNUP' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Data de Nascimento</label>
              <input
                type="date"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center text-xs font-medium text-red-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-amber-500 px-4 py-4 text-sm font-bold text-neutral-950 transition-all hover:bg-amber-400 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Aguarde...' : tab === 'LOGIN' ? 'Entrar' : 'Criar Conta'}
          </button>
        </form>

        {role === 'CLIENT' && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setTab(tab === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}
              className="text-xs font-medium text-neutral-400 hover:text-amber-500 transition-colors"
            >
              {tab === 'LOGIN' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça Login'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

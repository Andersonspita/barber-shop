'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ApiError, SessionUser, api, saveSession } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

interface AuthResponse {
  access_token: string;
  user: SessionUser;
}

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const isStaffArea = params.get('area') === 'profissional';
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await api<AuthResponse>(
        mode === 'login' ? '/auth/login' : '/auth/signup',
        {
          method: 'POST',
          body:
            mode === 'login'
              ? { email, pass: password }
              : {
                  name,
                  email,
                  pass: password,
                  phoneNumber: phone,
                  birthDate: birthDate || undefined,
                },
        },
      );

      // O cadastro já devolve sessão: pedir para "fazer login agora" logo
      // depois de criar a conta era um passo a mais sem motivo.
      saveSession(result.access_token, result.user);

      if (result.user.mustChangePassword) {
        toast.info(
          'Defina uma senha sua',
          'Esta conta foi criada com uma senha temporária.',
        );
      }

      const isStaff = result.user.role === 'BARBER' || result.user.isAdmin;
      router.push(isStaff ? '/dashboard' : '/reservas');
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Não foi possível continuar. Tente de novo.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      id="conteudo"
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
    >
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao site
        </Link>

        <div className="rounded-card border border-line bg-surface-1 p-6 sm:p-8">
          <div className="mb-7 text-center">
            <span
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 font-display text-xl font-black text-surface-0"
              aria-hidden="true"
            >
              GB
            </span>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
              {isStaffArea ? 'Área do profissional' : 'Gerente Barber'}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {isStaffArea
                ? 'Acesse o painel da barbearia.'
                : mode === 'login'
                  ? 'Entre para ver e marcar seus horários.'
                  : 'Crie sua conta em menos de um minuto.'}
            </p>
          </div>

          {/* Cliente pode alternar entre entrar e cadastrar; profissional só
              entra — a conta dele é criada pelo administrador. */}
          {!isStaffArea && (
            <div
              role="tablist"
              aria-label="Entrar ou criar conta"
              className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1"
            >
              {(['login', 'signup'] as const).map((value) => (
                <button
                  key={value}
                  role="tab"
                  type="button"
                  aria-selected={mode === value}
                  onClick={() => {
                    setMode(value);
                    setError('');
                  }}
                  className={cn(
                    'rounded-lg py-2.5 text-sm font-bold transition-colors',
                    mode === value
                      ? 'bg-brand-500 text-surface-0'
                      : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {value === 'login' ? 'Entrar' : 'Criar conta'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'signup' && (
              <Field label="Seu nome">
                {(props) => (
                  <Input
                    {...props}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Ex.: João Silva"
                  />
                )}
              </Field>
            )}

            <Field label="E-mail">
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="seu@email.com"
                />
              )}
            </Field>

            {mode === 'signup' && (
              // Telefone obrigatório: é por ele que saem a confirmação e o
              // lembrete. Antes o cadastro nem pedia, e as notificações
              // ficavam sem para onde ir.
              <Field
                label="Celular com DDD"
                hint="Usamos para enviar a confirmação e o lembrete no WhatsApp."
              >
                {(props) => (
                  <Input
                    {...props}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoComplete="tel"
                    placeholder="(11) 99999-9999"
                  />
                )}
              </Field>
            )}

            <Field
              label="Senha"
              hint={
                mode === 'signup'
                  ? 'Ao menos 8 caracteres, com letras e números.'
                  : undefined
              }
            >
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  placeholder="••••••••"
                />
              )}
            </Field>

            {mode === 'signup' && (
              <Field
                label="Data de nascimento"
                hint="Opcional. É como sabemos o seu aniversário."
              >
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                  />
                )}
              </Field>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
              >
                {error}
              </p>
            )}

            <Button type="submit" size="lg" block loading={loading}>
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          {mode === 'login' && (
            <p className="mt-5 text-center">
              <Link
                href="/login/recuperar"
                className="text-sm font-semibold text-ink-muted transition-colors hover:text-brand-400"
              >
                Esqueci minha senha
              </Link>
            </p>
          )}
        </div>

        {!isStaffArea && (
          <p className="mt-5 text-center text-sm text-ink-subtle">
            É da equipe?{' '}
            <Link
              href="/login?area=profissional"
              className="font-semibold text-ink-muted transition-colors hover:text-brand-400"
            >
              Entrar pela área do profissional
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

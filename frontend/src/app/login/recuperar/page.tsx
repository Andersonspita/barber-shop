'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

/**
 * Recuperação de senha — não existia em lugar nenhum: quem esquecia a senha
 * perdia a conta e precisava pedir ao administrador para criar outra.
 */
function RecoverForm() {
  const params = useSearchParams();
  const token = params.get('token');

  return token ? <ResetStep token={token} /> : <RequestStep />;
}

function RequestStep() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: { email },
      });
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Tente de novo em instantes.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Shell title="Confira seu WhatsApp">
        <div className="text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/12 text-success">
            <MailCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm leading-relaxed text-ink-muted">
            Se este e-mail estiver cadastrado, enviamos um link de recuperação
            para o WhatsApp da conta. Ele vale por 30 minutos.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-bold text-brand-400 transition-colors hover:text-brand-300"
          >
            Voltar para entrar
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      title="Recuperar senha"
      description="Informe o e-mail da sua conta. Enviamos o link de redefinição para o WhatsApp cadastrado."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            {error}
          </p>
        )}

        <Button type="submit" size="lg" block loading={loading}>
          Enviar link
        </Button>
      </form>
    </Shell>
  );
}

function ResetStep({ token }: { token: string }) {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password !== confirmation) {
      setError('As duas senhas precisam ser iguais.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { token, newPass: password },
      });
      toast.success('Senha redefinida', 'Entre com a nova senha.');
      router.push('/login');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Tente de novo em instantes.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell
      title="Defina a nova senha"
      description="Escolha uma senha com pelo menos 8 caracteres, incluindo letras e números."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Nova senha">
          {(props) => (
            <Input
              {...props}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
            />
          )}
        </Field>

        <Field label="Repita a nova senha">
          {(props) => (
            <Input
              {...props}
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
            />
          )}
        </Field>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            {error}
          </p>
        )}

        <Button type="submit" size="lg" block loading={loading}>
          Salvar nova senha
        </Button>
      </form>
    </Shell>
  );
}

function Shell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      id="conteudo"
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
    >
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </Link>

        <div className="rounded-card border border-line bg-surface-1 p-6 sm:p-8">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            {title}
          </h1>
          {description && (
            <p className="mb-6 mt-2 text-sm leading-relaxed text-ink-muted">
              {description}
            </p>
          )}
          <div className={description ? '' : 'mt-6'}>{children}</div>
        </div>
      </div>
    </main>
  );
}

export default function RecoverPage() {
  return (
    <Suspense fallback={null}>
      <RecoverForm />
    </Suspense>
  );
}

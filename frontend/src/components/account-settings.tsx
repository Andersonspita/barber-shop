'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { KeyRound, UserCog } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

interface Profile {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  birthDate: string | null;
}

/**
 * Conta do usuário. A tela anterior só trocava a senha — e usava `alert()`
 * para todo retorno. Nome, telefone e data de nascimento não tinham como ser
 * corrigidos por quem já estava cadastrado.
 */
export function AccountSettings() {
  const toast = useToast();
  const params = useSearchParams();
  const mustChange = params.get('trocar') === '1';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    api<Profile>('/auth/me', { auth: true })
      .then((data) => {
        setProfile(data);
        setName(data.name);
        setPhone(data.phoneNumber ?? '');
        setBirthDate(data.birthDate ? data.birthDate.slice(0, 10) : '');
      })
      .catch(() => undefined);
  }, []);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await api('/auth/me', {
        method: 'PUT',
        auth: true,
        body: {
          name,
          phoneNumber: phone || undefined,
          birthDate: birthDate || undefined,
        },
      });
      toast.success('Dados atualizados');
    } catch (caught) {
      toast.error(
        'Não foi possível salvar',
        caught instanceof ApiError ? caught.message : undefined,
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError('');

    if (newPass !== confirmPass) {
      setPasswordError('As duas senhas precisam ser iguais.');
      return;
    }

    setSavingPassword(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        auth: true,
        body: { currentPass, newPass },
      });
      toast.success('Senha alterada com sucesso');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (caught) {
      setPasswordError(
        caught instanceof ApiError
          ? caught.message
          : 'Não foi possível alterar a senha.',
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {mustChange && (
        <div
          role="alert"
          className="rounded-card border border-brand-500/30 bg-brand-500/10 px-5 py-4"
        >
          <p className="text-sm font-bold text-brand-400">
            Defina uma senha sua
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Esta conta foi criada com uma senha temporária. Troque agora para
            manter seu acesso seguro.
          </p>
        </div>
      )}

      <Card>
        <CardHeader
          title="Meus dados"
          description="É por aqui que enviamos confirmações e lembretes."
        />
        <CardBody>
          <form onSubmit={saveProfile} className="space-y-4">
            <Field label="Nome">
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              )}
            </Field>

            <Field label="E-mail" hint="O e-mail de acesso não pode ser alterado por aqui.">
              {(props) => (
                <Input
                  {...props}
                  value={profile?.email ?? ''}
                  disabled
                  readOnly
                />
              )}
            </Field>

            <Field
              label="Celular com DDD"
              hint="Sem telefone, a confirmação e o lembrete não têm como chegar."
            >
              {(props) => (
                <Input
                  {...props}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="(11) 99999-9999"
                />
              )}
            </Field>

            <Field
              label="Data de nascimento"
              hint="Usamos só para lembrar do seu aniversário."
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

            <Button type="submit" loading={savingProfile}>
              <UserCog className="h-4 w-4" aria-hidden="true" />
              Salvar dados
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Senha"
          description="Escolha algo com pelo menos 8 caracteres, entre letras e números."
        />
        <CardBody>
          <form onSubmit={savePassword} className="space-y-4">
            <Field label="Senha atual">
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              )}
            </Field>

            <Field label="Nova senha">
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              )}
            </Field>

            <Field label="Repita a nova senha" error={passwordError}>
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              )}
            </Field>

            <Button type="submit" loading={savingPassword}>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Atualizar senha
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

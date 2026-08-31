'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SessionUser, api, clearSession, getToken } from './api';

type Guard = 'CLIENT' | 'STAFF' | 'ADMIN';

/**
 * Guarda de rota.
 *
 * Cada tela repetia este bloco — ler o localStorage, comparar o papel,
 * redirecionar — com variações que às vezes deixavam o conteúdo aparecer por
 * um instante antes do redirecionamento.
 *
 * A sessão é confirmada contra `/auth/me`, não contra o que está guardado no
 * navegador: assim uma conta desativada ou um papel alterado pelo admin valem
 * na hora, e um token adulterado não engana a interface.
 */
export function useSession(guard: Guard) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loginPath = guard === 'CLIENT' ? '/login' : '/login?area=profissional';

    void (async () => {
      if (!getToken()) {
        if (!cancelled) router.replace(loginPath);
        return;
      }

      let session: SessionUser;
      try {
        session = await api<SessionUser>('/auth/me', { auth: true });
      } catch {
        if (!cancelled) {
          clearSession();
          router.replace(loginPath);
        }
        return;
      }

      if (cancelled) return;

      const isStaff = session.role === 'BARBER' || session.isAdmin;

      if (guard === 'CLIENT' && session.role !== 'CLIENT') {
        router.replace('/dashboard');
        return;
      }
      if (guard === 'STAFF' && !isStaff) {
        router.replace('/reservas');
        return;
      }
      if (guard === 'ADMIN' && !session.isAdmin) {
        router.replace('/dashboard');
        return;
      }

      // Conta criada pelo admin, com senha temporária, precisa trocar antes.
      if (session.mustChangePassword) {
        const target =
          session.role === 'CLIENT'
            ? '/reservas/configuracoes'
            : '/dashboard/configuracoes';
        if (window.location.pathname !== target) {
          router.replace(`${target}?trocar=1`);
          return;
        }
      }

      setUser(session);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [guard, router]);

  return { user, ready };
}

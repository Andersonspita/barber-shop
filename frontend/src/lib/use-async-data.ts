'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from './api';

interface AsyncData<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  /** Refaz a busca — use depois de criar, editar ou excluir algo. */
  reload: () => void;
  /** Ajuste otimista da lista, sem ida ao servidor. */
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Busca de dados para as telas.
 *
 * Duas coisas que o padrão anterior não fazia:
 *
 * 1. Descarta a resposta de uma requisição que já foi superada. Trocar de data
 *    depressa no painel disparava várias buscas, e a última a responder vencia
 *    — nem sempre a do dia que estava na tela.
 * 2. Nenhum `setState` roda de forma síncrona dentro do efeito, o que evita a
 *    cascata de renderizações que o React sinaliza.
 *
 * O `fetcher` precisa vir de `useCallback`, com as próprias dependências.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await fetcher();
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError('Algo deu errado ao carregar os dados.', 0),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetcher, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, loading, error, reload, setData };
}

'use client';

import React, { createContext, useContext, useLayoutEffect, useMemo } from 'react';
import { setCurrentShop } from './api';
import { shopHref } from './shop-href';

export interface ShopInfo {
  slug: string;
  name: string;
}

interface ShopContextValue extends ShopInfo {
  /** Caminho dentro da barbearia: `href('/reservas')` → `/<slug>/reservas`. */
  href: (path: string) => string;
}

const ShopContext = createContext<ShopContextValue | null>(null);

/**
 * Barbearia da página aberta, disponível para todo componente abaixo do
 * `app/[shop]/layout.tsx`.
 *
 * O `useLayoutEffect` avisa o cliente da API antes de qualquer `useEffect`
 * dos filhos rodar — é neles que as telas buscam dados, e a primeira chamada
 * já precisa sair com o cabeçalho `X-Shop` certo.
 */
export function ShopProvider({
  shop,
  children,
}: {
  shop: ShopInfo;
  children: React.ReactNode;
}) {
  useLayoutEffect(() => {
    setCurrentShop(shop.slug);
    return () => setCurrentShop(null);
  }, [shop.slug]);

  const value = useMemo<ShopContextValue>(
    () => ({
      ...shop,
      href: (path: string) => shopHref(shop.slug, path),
    }),
    [shop],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop precisa estar dentro de <ShopProvider>.');
  }
  return context;
}

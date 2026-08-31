import { API_URL } from './api';

/**
 * Busca no servidor, para a landing page renderizar já com conteúdo.
 *
 * A versão anterior era `"use client"` e buscava serviços e barbeiros no
 * navegador: o robô do Google recebia uma casca com esqueletos animados. Para
 * uma barbearia, a busca local é o canal de aquisição.
 */
export async function serverFetch<T>(
  path: string,
  fallback: T,
  revalidate = 300,
): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      next: { revalidate },
    });
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    // Landing page não pode cair porque a API está reiniciando.
    return fallback;
  }
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string | number;
}

export interface PublicBarber {
  id: string;
  name: string;
  photoUrl: string | null;
  bio: string | null;
  rating: number | null;
  reviewCount: number;
}

export interface PublicShop {
  name: string;
  timezone: string;
  addressLine: string | null;
  city: string | null;
  mapsUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  about: string | null;
  maxAdvanceDays: number;
  cancellationWindowMinutes: number;
}

export const FALLBACK_SHOP: PublicShop = {
  name: 'Gerente Barber',
  timezone: 'America/Sao_Paulo',
  addressLine: null,
  city: null,
  mapsUrl: null,
  phone: null,
  whatsapp: null,
  instagram: null,
  about: null,
  maxAdvanceDays: 60,
  cancellationWindowMinutes: 120,
};

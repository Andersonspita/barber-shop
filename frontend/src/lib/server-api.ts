import { API_URL } from './api';

/**
 * Endereço da API visto pelo servidor Next. Dentro do docker-compose o
 * frontend fala direto com o contêiner do backend (`API_INTERNAL_URL`); o
 * `NEXT_PUBLIC_API_URL` costuma estar vazio em produção, e um fetch relativo
 * no servidor não tem para onde ir.
 */
const SERVER_API_URL =
  process.env.API_INTERNAL_URL || API_URL || 'http://localhost:3333';

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
  options: { shop?: string; revalidate?: number } = {},
): Promise<T> {
  try {
    const response = await fetch(`${SERVER_API_URL}${path}`, {
      headers: options.shop ? { 'X-Shop': options.shop } : undefined,
      next: { revalidate: options.revalidate ?? 300 },
    });
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    // Landing page não pode cair porque a API está reiniciando.
    return fallback;
  }
}

/**
 * Barbearia do endereço, ou `null` se o slug não existir (ou estiver
 * suspensa). Uma API fora do ar lança erro em vez de devolver `null`: a
 * página de erro é honesta, um "barbearia não encontrada" não seria.
 */
export async function fetchShop(slug: string): Promise<PublicShop | null> {
  // Sem cache: suspender uma barbearia ou trocar o slug precisa tirar a
  // página do ar na hora. A API já guarda a barbearia em memória, então a
  // consulta custa pouco.
  const response = await fetch(`${SERVER_API_URL}/shop`, {
    headers: { 'X-Shop': slug },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`A API respondeu ${response.status} ao buscar a barbearia.`);
  }
  return (await response.json()) as PublicShop;
}

export interface DirectoryShop {
  slug: string;
  name: string;
  city: string | null;
  about: string | null;
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
  slug: string;
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

/**
 * Endereço da API visto pelo navegador. Vazio quando o nginx serve frontend e
 * API no mesmo domínio — aí as chamadas saem relativas à página.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

// ------------------------------------------------------------ barbearia

let currentShop: string | null = null;

/**
 * Barbearia da página aberta, definida pelo `ShopProvider`. Vai no cabeçalho
 * `X-Shop` de toda chamada e separa as sessões guardadas no navegador.
 */
export function setCurrentShop(slug: string | null) {
  currentShop = slug;
}

export function getCurrentShop(): string | null {
  return currentShop;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Anexa o token guardado no navegador. */
  auth?: boolean;
  query?: Record<string, string | number | undefined | null>;
}

/**
 * Cliente único da API.
 *
 * Antes cada tela montava seu próprio `fetch`, com seu próprio tratamento de
 * erro (ou nenhum) e sua própria reação ao 401. Aqui a mensagem do backend
 * chega pronta para a interface e a sessão expirada é tratada num lugar só.
 */
export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, auth = false, query, headers, ...rest } = options;

  // Com API_URL vazio, `new URL('/services')` lançava erro no navegador: a
  // base precisa ser a própria página.
  const url = new URL(
    `${API_URL}${path}`,
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
  );
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const finalHeaders = new Headers(headers);
  if (currentShop) finalHeaders.set('X-Shop', currentShop);
  if (body !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      'Não conseguimos falar com o servidor. Verifique sua conexão.',
      0,
    );
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && auth) clearSession();
    throw new ApiError(extractMessage(payload, response.status), response.status);
  }

  return payload as T;
}

/**
 * O ValidationPipe do Nest devolve `message` como array quando há mais de um
 * campo inválido. Mostrar `[object Object]` para o usuário não ajuda ninguém.
 */
function extractMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
  }

  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (status === 403) return 'Você não tem acesso a esta área.';
  if (status === 429) return 'Muitas tentativas. Aguarde um instante.';
  return 'Algo deu errado. Tente de novo em alguns segundos.';
}

// ---------------------------------------------------------------- sessão

const TOKEN_KEY = 'access_token';
const USER_KEY = 'session_user';

/**
 * Uma sessão por barbearia: quem é cliente de duas tem duas contas, e entrar
 * numa não pode derrubar — nem reaproveitar — a sessão da outra.
 */
function sessionKey(base: string): string {
  return currentShop ? `${base}:${currentShop}` : base;
}

export interface SessionUser {
  id: string;
  shopId?: string;
  name: string;
  email: string;
  role: 'CLIENT' | 'BARBER' | 'ADMIN';
  isAdmin: boolean;
  photoUrl?: string | null;
  mustChangePassword?: boolean;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(sessionKey(TOKEN_KEY));
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(sessionKey(USER_KEY));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: SessionUser) {
  window.localStorage.setItem(sessionKey(TOKEN_KEY), token);
  window.localStorage.setItem(sessionKey(USER_KEY), JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(sessionKey(TOKEN_KEY));
  window.localStorage.removeItem(sessionKey(USER_KEY));
  // Chaves de versões anteriores: sessão sem barbearia e papel/nome soltos.
  for (const legacy of [
    TOKEN_KEY,
    USER_KEY,
    'user_role',
    'is_admin',
    'user_name',
  ]) {
    window.localStorage.removeItem(legacy);
  }
}

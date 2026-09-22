/**
 * Caminho dentro de uma barbearia: `shopHref('navalha', '/reservas')` →
 * `/navalha/reservas`. Fica fora do `shop-context` (client) para que
 * componentes de servidor também possam chamá-la.
 */
export function shopHref(slug: string, path: string): string {
  if (path === '/' || path === '') return `/${slug}`;
  return `/${slug}${path.startsWith('/') ? path : `/${path}`}`;
}

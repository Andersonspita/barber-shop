import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Scissors,
  Settings,
  Store,
  Users,
} from 'lucide-react';
import type { NavItem } from '@/components/app-header';

/** Navegação do cliente. */
export const CLIENT_NAV: NavItem[] = [
  { href: '/reservas', label: 'Minhas reservas', icon: CalendarCheck },
  { href: '/reservas/nova', label: 'Agendar', icon: CalendarPlus },
  { href: '/reservas/configuracoes', label: 'Minha conta', icon: Settings },
];

/** Navegação do barbeiro sem privilégio de administrador. */
export const BARBER_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Agenda', icon: CalendarDays },
  { href: '/dashboard/financeiro', label: 'Financeiro', icon: BarChart3 },
  { href: '/dashboard/configuracoes', label: 'Minha conta', icon: Settings },
];

/** Navegação de quem administra a barbearia. */
export const ADMIN_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Agenda', icon: CalendarDays },
  { href: '/dashboard/barbearia', label: 'Barbearia', icon: Store },
  { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
  { href: '/dashboard/equipe', label: 'Equipe', icon: Scissors },
  { href: '/dashboard/financeiro', label: 'Financeiro', icon: BarChart3 },
  { href: '/dashboard/configuracoes', label: 'Minha conta', icon: Settings },
];

export function staffNav(isAdmin: boolean): NavItem[] {
  return isAdmin ? ADMIN_NAV : BARBER_NAV;
}

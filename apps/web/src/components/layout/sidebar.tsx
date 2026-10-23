'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Heart,
  UsersRound,
  Calendar,
  MessageSquare,
  Baby,
  HandCoins,
  GraduationCap,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Pessoas', href: '/pessoas', icon: Users },
  { name: 'Ministérios', href: '/ministerios', icon: Heart },
  { name: 'Grupos', href: '/grupos', icon: UsersRound },
  { name: 'Eventos', href: '/eventos', icon: Calendar },
  { name: 'Comunicação', href: '/comunicacao', icon: MessageSquare },
  { name: 'Kids', href: '/kids', icon: Baby },
  { name: 'Doações', href: '/doacoes', icon: HandCoins },
  { name: 'Escola', href: '/escola', icon: GraduationCap },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3 },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  function handleLogout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    window.location.href = '/login';
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-white border-r border-gray-200 flex flex-col z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <span className="text-xl font-bold">
            <span className="text-primary-600">eco</span>
            <span className="text-gray-800">PULSE</span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  <item.icon className={cn('w-5 h-5', isActive ? 'text-primary-600' : 'text-gray-400')} />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors w-full"
        >
          <LogOut className="w-5 h-5 text-gray-400" />
          Sair
        </button>
      </div>
    </aside>
  );
}

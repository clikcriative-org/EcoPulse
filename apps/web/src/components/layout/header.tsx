'use client';

import { Bell, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Header() {
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [tenant, setTenant] = useState<{ name: string } | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedTenant = localStorage.getItem('tenant');
    if (storedUser) setUser(JSON.parse(storedUser));
    if (storedTenant) setTenant(JSON.parse(storedTenant));
  }, []);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar pessoas, grupos, eventos..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-800">{user?.name || 'Carregando...'}</p>
            <p className="text-xs text-gray-500">{tenant?.name || ''}</p>
          </div>
          <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-700 font-semibold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

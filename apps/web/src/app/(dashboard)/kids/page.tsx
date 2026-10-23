'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Baby, Plus, Search, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

interface Child {
  id: string;
  fullName: string;
  ageGroup: string | null;
  parentName: string;
  parentPhone: string;
  allergies: string | null;
  photoUrl: string | null;
}

interface Stats {
  totalChildren: number;
  activeCheckIns: number;
  todayCheckIns: number;
}

export default function KidsPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [stats, setStats] = useState<Stats>({ totalChildren: 0, activeCheckIns: 0, todayCheckIns: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [childrenRes, statsRes] = await Promise.all([
        api.get('/kids/children'),
        api.get('/kids/stats'),
      ]);
      setChildren(childrenRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados Kids:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = children.filter((c) =>
    c.fullName.toLowerCase().includes(search.toLowerCase()) ||
    c.parentName.toLowerCase().includes(search.toLowerCase())
  );

  const ageGroupLabel: Record<string, string> = {
    baby: 'Berçário',
    toddler: 'Maternal',
    preschool: 'Pré-escola',
    elementary: 'Fundamental',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RNO Kids</h1>
          <p className="text-gray-500 mt-1">Check-in seguro de crianças</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/kids/checkin"
            className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2"
          >
            <Baby className="w-4 h-4" />
            Check-in
          </Link>
          <Link
            href="/kids/cadastro"
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Cadastrar
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Cadastradas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalChildren}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Presentes Agora</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.activeCheckIns}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Check-ins Hoje</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.todayCheckIns}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome da criança ou responsável..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Children list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {children.length === 0
              ? 'Nenhuma criança cadastrada ainda'
              : 'Nenhum resultado encontrado'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Criança</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Faixa Etária</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Responsável</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Alergias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((child) => (
                <tr key={child.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-pink-100 rounded-full flex items-center justify-center">
                        <span className="text-pink-600 font-semibold text-sm">
                          {child.fullName.charAt(0)}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">{child.fullName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {child.ageGroup ? ageGroupLabel[child.ageGroup] || child.ageGroup : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900">{child.parentName}</p>
                    <p className="text-xs text-gray-500">{child.parentPhone}</p>
                  </td>
                  <td className="px-6 py-4">
                    {child.allergies ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        {child.allergies}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Nenhuma</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

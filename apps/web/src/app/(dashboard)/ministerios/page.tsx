'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Users, Heart } from 'lucide-react';
import { api } from '@/lib/api';

interface Ministry {
  id: string;
  name: string;
  description: string | null;
  color: string;
  iconName: string | null;
  active: boolean;
  _count: { members: number };
}

interface Stats {
  totalMinistries: number;
  totalVolunteers: number;
}

export default function MinisteriosPage() {
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [stats, setStats] = useState<Stats>({ totalMinistries: 0, totalVolunteers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [ministriesRes, statsRes] = await Promise.all([
        api.get('/ministries'),
        api.get('/ministries/stats'),
      ]);
      setMinistries(ministriesRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ministérios</h1>
          <p className="text-gray-500 mt-1">Gerencie ministérios e voluntários</p>
        </div>
        <Link
          href="/ministerios/cadastro"
          className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Ministério
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalMinistries}</p>
              <p className="text-sm text-gray-500">Ministérios ativos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalVolunteers}</p>
              <p className="text-sm text-gray-500">Voluntários servindo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ministries grid */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Carregando...
        </div>
      ) : ministries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <p>Nenhum ministério cadastrado ainda</p>
          <p className="text-sm mt-1">Clique em &quot;+ Novo Ministério&quot; para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ministries.map((ministry) => (
            <Link
              key={ministry.id}
              href={`/ministerios/${ministry.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: ministry.color + '20' }}
                  >
                    <Heart className="w-5 h-5" style={{ color: ministry.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-700 transition">
                      {ministry.name}
                    </h3>
                    {ministry.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ministry.description}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {ministry._count.members} voluntário{ministry._count.members !== 1 ? 's' : ''}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

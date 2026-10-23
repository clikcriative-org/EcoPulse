'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, UsersRound, MapPin, Clock, Filter } from 'lucide-react';
import { api } from '@/lib/api';

interface Group {
  id: string;
  name: string;
  description: string | null;
  type: string;
  meetingDay: string | null;
  meetingTime: string | null;
  address: string | null;
  maxMembers: number | null;
  _count: { members: number };
}

interface Stats {
  totalGroups: number;
  totalCells: number;
  totalMembers: number;
}

const typeLabel: Record<string, string> = {
  CELL: 'Célula',
  DISCIPLESHIP: 'Discipulado',
  MINISTRY_GROUP: 'Grupo de Ministério',
  COURSE_GROUP: 'Grupo de Curso',
};

const typeColor: Record<string, string> = {
  CELL: 'bg-green-50 text-green-700',
  DISCIPLESHIP: 'bg-purple-50 text-purple-700',
  MINISTRY_GROUP: 'bg-blue-50 text-blue-700',
  COURSE_GROUP: 'bg-orange-50 text-orange-700',
};

export default function GruposPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<Stats>({ totalGroups: 0, totalCells: 0, totalMembers: 0 });
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [filterType]);

  async function loadData() {
    setLoading(true);
    try {
      const params: any = {};
      if (filterType) params.type = filterType;

      const [groupsRes, statsRes] = await Promise.all([
        api.get('/groups', { params }),
        api.get('/groups/stats'),
      ]);
      setGroups(groupsRes.data);
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
          <h1 className="text-2xl font-bold text-gray-900">Grupos & Células</h1>
          <p className="text-gray-500 mt-1">Gerencie grupos, células e discipulado</p>
        </div>
        <Link
          href="/grupos/cadastro"
          className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Grupo
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total de Grupos</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalGroups}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Células</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.totalCells}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Participantes</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalMembers}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { key: '', label: 'Todos' },
          { key: 'CELL', label: 'Células' },
          { key: 'DISCIPLESHIP', label: 'Discipulado' },
          { key: 'MINISTRY_GROUP', label: 'Ministério' },
          { key: 'COURSE_GROUP', label: 'Curso' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterType(f.key)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
              filterType === f.key
                ? 'bg-primary-100 text-primary-700'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Groups grid */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Carregando...
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <p>Nenhum grupo cadastrado ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/grupos/${group.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 group-hover:text-primary-700 transition">
                  {group.name}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor[group.type] || 'bg-gray-50 text-gray-600'}`}>
                  {typeLabel[group.type] || group.type}
                </span>
              </div>

              {group.description && (
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{group.description}</p>
              )}

              <div className="space-y-1.5">
                {group.meetingDay && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    {group.meetingDay}{group.meetingTime ? ` às ${group.meetingTime}` : ''}
                  </div>
                )}
                {group.address && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="line-clamp-1">{group.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <UsersRound className="w-3.5 h-3.5" />
                  {group._count.members} membro{group._count.members !== 1 ? 's' : ''}
                  {group.maxMembers && ` / ${group.maxMembers}`}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

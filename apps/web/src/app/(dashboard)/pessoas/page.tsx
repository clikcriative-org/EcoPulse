'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Plus, Search, Filter, UserCheck, Crown } from 'lucide-react';
import { api } from '@/lib/api';

interface Member {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: string;
  status: string;
  isVolunteer: boolean;
  isLeader: boolean;
  photoUrl: string | null;
  memberSince: string | null;
  city: string | null;
}

interface Stats {
  total: number;
  active: number;
  volunteers: number;
  leaders: number;
  baptized: number;
  birthdaysThisMonth: number;
}

export default function PessoasPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, volunteers: 0, leaders: 0, baptized: 0, birthdaysThisMonth: 0 });
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadMembers();
  }, [search, filter, meta.page]);

  async function loadStats() {
    try {
      const { data } = await api.get('/members/stats');
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadMembers() {
    setLoading(true);
    try {
      const params: any = { page: meta.page, limit: 20 };
      if (search) params.search = search;
      if (filter === 'volunteers') params.isVolunteer = 'true';
      if (filter === 'leaders') params.isLeader = 'true';
      if (filter === 'inactive') params.status = 'INACTIVE';

      const { data } = await api.get('/members', { params });
      setMembers(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pessoas</h1>
          <p className="text-gray-500 mt-1">Gerencie membros, famílias e visitantes</p>
        </div>
        <Link
          href="/pessoas/cadastro"
          className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Membro
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-1">Total</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          <p className="text-xs text-gray-500 mt-1">Ativos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.volunteers}</p>
          <p className="text-xs text-gray-500 mt-1">Voluntários</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{stats.leaders}</p>
          <p className="text-xs text-gray-500 mt-1">Líderes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{stats.baptized}</p>
          <p className="text-xs text-gray-500 mt-1">Batizados</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-pink-600">{stats.birthdaysThisMonth}</p>
          <p className="text-xs text-gray-500 mt-1">Aniversários</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setMeta(m => ({ ...m, page: 1 })); }}
            placeholder="Buscar por nome, email ou telefone..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: '', label: 'Todos' },
            { key: 'volunteers', label: 'Voluntários' },
            { key: 'leaders', label: 'Líderes' },
            { key: 'inactive', label: 'Inativos' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setMeta(m => ({ ...m, page: 1 })); }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                filter === f.key
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Nenhum membro encontrado
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Contato</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Cidade</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Membro desde</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Perfil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <Link href={`/pessoas/${member.id}`} className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-700 font-semibold text-sm">
                            {member.fullName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{member.fullName}</p>
                          <p className="text-xs text-gray-500">
                            {member.status === 'ACTIVE' ? '● Ativo' : '○ Inativo'}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <p className="text-sm text-gray-700">{member.phone || '—'}</p>
                      <p className="text-xs text-gray-500">{member.email || ''}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">
                      {member.city || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">
                      {formatDate(member.memberSince)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {member.isLeader && (
                          <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                            <Crown className="w-3 h-3" /> Líder
                          </span>
                        )}
                        {member.isVolunteer && !member.isLeader && (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            <UserCheck className="w-3 h-3" /> Voluntário
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  {meta.total} membro{meta.total !== 1 ? 's' : ''} • Página {meta.page} de {meta.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMeta(m => ({ ...m, page: m.page - 1 }))}
                    disabled={meta.page <= 1}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setMeta(m => ({ ...m, page: m.page + 1 }))}
                    disabled={meta.page >= meta.totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Heart, Users, Plus, UserMinus, Crown, UserCheck, User } from 'lucide-react';
import { api } from '@/lib/api';

interface Volunteer {
  id: string;
  role: string;
  function: string | null;
  member: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    photoUrl: string | null;
  };
}

interface Ministry {
  id: string;
  name: string;
  description: string | null;
  color: string;
  members: Volunteer[];
}

export default function MinistryDetailPage() {
  const params = useParams();
  const [ministry, setMinistry] = useState<Ministry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchMembers, setSearchMembers] = useState('');
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [addingRole, setAddingRole] = useState('volunteer');
  const [addingFunction, setAddingFunction] = useState('');

  useEffect(() => {
    loadMinistry();
  }, []);

  async function loadMinistry() {
    try {
      const { data } = await api.get(`/ministries/${params.id}`);
      setMinistry(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function searchAvailableMembers(query: string) {
    setSearchMembers(query);
    if (query.length < 2) {
      setAvailableMembers([]);
      return;
    }
    try {
      const { data } = await api.get('/members', { params: { search: query, limit: 10 } });
      // Filter out members already in this ministry
      const existingIds = new Set(ministry?.members.map((m) => m.member.id) || []);
      setAvailableMembers(data.data.filter((m: any) => !existingIds.has(m.id)));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddVolunteer(memberId: string) {
    try {
      await api.post(`/ministries/${params.id}/volunteers`, {
        memberId,
        role: addingRole,
        function: addingFunction || undefined,
      });
      setShowAddModal(false);
      setSearchMembers('');
      setAvailableMembers([]);
      setAddingRole('volunteer');
      setAddingFunction('');
      loadMinistry();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao adicionar voluntário');
    }
  }

  async function handleRemoveVolunteer(memberId: string) {
    if (!confirm('Remover este voluntário do ministério?')) return;
    try {
      await api.delete(`/ministries/${params.id}/volunteers/${memberId}`);
      loadMinistry();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao remover');
    }
  }

  const roleIcon: Record<string, any> = {
    leader: Crown,
    coordinator: UserCheck,
    volunteer: User,
  };

  const roleLabel: Record<string, string> = {
    leader: 'Líder',
    coordinator: 'Coordenador',
    volunteer: 'Voluntário',
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Carregando...</div>;
  }

  if (!ministry) {
    return <div className="py-20 text-center text-gray-400">Ministério não encontrado</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/ministerios" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: ministry.color + '20' }}
          >
            <Heart className="w-6 h-6" style={{ color: ministry.color }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{ministry.name}</h1>
            {ministry.description && (
              <p className="text-gray-500 text-sm mt-0.5">{ministry.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      {/* Volunteers count */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-gray-400" />
          <span className="text-lg font-semibold text-gray-900">
            {ministry.members.length} voluntário{ministry.members.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Volunteers list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {ministry.members.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Nenhum voluntário neste ministério ainda
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {ministry.members.map((vol) => {
              const RoleIcon = roleIcon[vol.role] || User;
              return (
                <div key={vol.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-700 font-semibold text-sm">
                        {vol.member.fullName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <Link href={`/pessoas/${vol.member.id}`} className="font-medium text-gray-900 hover:text-primary-700 transition">
                        {vol.member.fullName}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <RoleIcon className="w-3 h-3" />
                          {roleLabel[vol.role] || vol.role}
                        </span>
                        {vol.function && (
                          <span className="text-xs text-gray-400">• {vol.function}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {vol.member.phone && (
                      <span className="text-xs text-gray-500 hidden md:block">{vol.member.phone}</span>
                    )}
                    <button
                      onClick={() => handleRemoveVolunteer(vol.member.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Remover do ministério"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add volunteer modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Adicionar Voluntário</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar membro</label>
                <input
                  type="text"
                  value={searchMembers}
                  onChange={(e) => searchAvailableMembers(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Digite o nome do membro..."
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Papel</label>
                  <select
                    value={addingRole}
                    onChange={(e) => setAddingRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    <option value="volunteer">Voluntário</option>
                    <option value="coordinator">Coordenador</option>
                    <option value="leader">Líder</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
                  <input
                    type="text"
                    value={addingFunction}
                    onChange={(e) => setAddingFunction(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="Ex: Guitarrista"
                  />
                </div>
              </div>

              {/* Search results */}
              {availableMembers.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {availableMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleAddVolunteer(member.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-50 transition text-left"
                    >
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 text-xs font-semibold">{member.fullName.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.fullName}</p>
                        <p className="text-xs text-gray-500">{member.phone || member.email || ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchMembers.length >= 2 && availableMembers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">Nenhum membro encontrado</p>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => { setShowAddModal(false); setSearchMembers(''); setAvailableMembers([]); }}
                className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

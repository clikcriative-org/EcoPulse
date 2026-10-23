'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UsersRound, MapPin, Clock, Plus, UserMinus, Crown, Home, User } from 'lucide-react';
import { api } from '@/lib/api';

interface GroupMember {
  id: string;
  role: string;
  member: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    photoUrl: string | null;
  };
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  type: string;
  meetingDay: string | null;
  meetingTime: string | null;
  address: string | null;
  maxMembers: number | null;
  members: GroupMember[];
}

const typeLabel: Record<string, string> = {
  CELL: 'Célula',
  DISCIPLESHIP: 'Discipulado',
  MINISTRY_GROUP: 'Grupo de Ministério',
  COURSE_GROUP: 'Grupo de Curso',
};

const roleIcon: Record<string, any> = { leader: Crown, host: Home, member: User };
const roleLabel: Record<string, string> = { leader: 'Líder', host: 'Anfitrião', member: 'Membro' };

export default function GroupDetailPage() {
  const params = useParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchMembers, setSearchMembers] = useState('');
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [addingRole, setAddingRole] = useState('member');

  useEffect(() => {
    loadGroup();
  }, []);

  async function loadGroup() {
    try {
      const { data } = await api.get(`/groups/${params.id}`);
      setGroup(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function searchAvailable(query: string) {
    setSearchMembers(query);
    if (query.length < 2) { setAvailableMembers([]); return; }
    try {
      const { data } = await api.get('/members', { params: { search: query, limit: 10 } });
      const existingIds = new Set(group?.members.map((m) => m.member.id) || []);
      setAvailableMembers(data.data.filter((m: any) => !existingIds.has(m.id)));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddMember(memberId: string) {
    try {
      await api.post(`/groups/${params.id}/members`, { memberId, role: addingRole });
      setShowAddModal(false);
      setSearchMembers('');
      setAvailableMembers([]);
      setAddingRole('member');
      loadGroup();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao adicionar membro');
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Remover este membro do grupo?')) return;
    try {
      await api.delete(`/groups/${params.id}/members/${memberId}`);
      loadGroup();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao remover');
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Carregando...</div>;
  if (!group) return <div className="py-20 text-center text-gray-400">Grupo não encontrado</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/grupos" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700">
              {typeLabel[group.type] || group.type}
            </span>
          </div>
          {group.description && <p className="text-gray-500 text-sm mt-0.5">{group.description}</p>}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <UsersRound className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-lg font-bold text-gray-900">
              {group.members.length}{group.maxMembers ? ` / ${group.maxMembers}` : ''}
            </p>
            <p className="text-xs text-gray-500">Membros</p>
          </div>
        </div>
        {group.meetingDay && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">{group.meetingDay}</p>
              <p className="text-xs text-gray-500">{group.meetingTime || 'Horário não definido'}</p>
            </div>
          </div>
        )}
        {group.address && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <MapPin className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 line-clamp-1">{group.address}</p>
              <p className="text-xs text-gray-500">Local</p>
            </div>
          </div>
        )}
      </div>

      {/* Members list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Membros do Grupo</h2>
        </div>
        {group.members.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhum membro neste grupo ainda</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {group.members.map((gm) => {
              const RoleIcon = roleIcon[gm.role] || User;
              return (
                <div key={gm.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-700 font-semibold text-sm">{gm.member.fullName.charAt(0)}</span>
                    </div>
                    <div>
                      <Link href={`/pessoas/${gm.member.id}`} className="font-medium text-gray-900 hover:text-primary-700 transition">
                        {gm.member.fullName}
                      </Link>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 ml-2">
                        <RoleIcon className="w-3 h-3" />
                        {roleLabel[gm.role] || gm.role}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {gm.member.phone && <span className="text-xs text-gray-500 hidden md:block">{gm.member.phone}</span>}
                    <button
                      onClick={() => handleRemoveMember(gm.member.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
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

      {/* Add member modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Adicionar Membro</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar membro</label>
                <input
                  type="text"
                  value={searchMembers}
                  onChange={(e) => searchAvailable(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Digite o nome..."
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Papel</label>
                <select
                  value={addingRole}
                  onChange={(e) => setAddingRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="member">Membro</option>
                  <option value="host">Anfitrião</option>
                  <option value="leader">Líder</option>
                </select>
              </div>
              {availableMembers.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {availableMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleAddMember(member.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-50 transition text-left"
                    >
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 text-xs font-semibold">{member.fullName.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.fullName}</p>
                        <p className="text-xs text-gray-500">{member.phone || ''}</p>
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

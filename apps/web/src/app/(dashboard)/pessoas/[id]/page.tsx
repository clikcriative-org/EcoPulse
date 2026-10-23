'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Heart, Users, Crown, UserCheck, HandCoins } from 'lucide-react';
import { api } from '@/lib/api';

export default function MemberProfilePage() {
  const params = useParams();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMember();
  }, []);

  async function loadMember() {
    try {
      const { data } = await api.get(`/members/${params.id}`);
      setMember(data);
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

  function formatCurrency(cents: number) {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400">Membro não encontrado</p>
      </div>
    );
  }

  const genderLabel: Record<string, string> = {
    MALE: 'Masculino',
    FEMALE: 'Feminino',
    OTHER: 'Outro',
    NOT_INFORMED: 'Não informado',
  };

  const maritalLabel: Record<string, string> = {
    SINGLE: 'Solteiro(a)',
    MARRIED: 'Casado(a)',
    DIVORCED: 'Divorciado(a)',
    WIDOWED: 'Viúvo(a)',
    NOT_INFORMED: 'Não informado',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/pessoas" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{member.fullName}</h1>
          <p className="text-gray-500 mt-0.5">
            {member.status === 'ACTIVE' ? '● Ativo' : '○ Inativo'}
            {member.isLeader && ' • Líder'}
            {member.isVolunteer && !member.isLeader && ' • Voluntário'}
          </p>
        </div>
        <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center">
          <span className="text-primary-700 font-bold text-xl">{member.fullName.charAt(0)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact & Personal */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações Pessoais</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {member.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{member.email}</span>
                </div>
              )}
              {member.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{member.phone}</span>
                </div>
              )}
              {member.city && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{member.city}{member.state ? `, ${member.state}` : ''}</span>
                </div>
              )}
              {member.birthDate && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">Nasc: {formatDate(member.birthDate)}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Gênero:</span>
                <span className="text-sm text-gray-700">{genderLabel[member.gender]}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Estado civil:</span>
                <span className="text-sm text-gray-700">{maritalLabel[member.maritalStatus]}</span>
              </div>
            </div>
          </div>

          {/* Church info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados da Igreja</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Membro desde</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{formatDate(member.memberSince)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Batismo</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{formatDate(member.baptismDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Salvação</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{formatDate(member.salvationDate)}</p>
              </div>
            </div>
          </div>

          {/* Ministries */}
          {member.ministryMembers?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ministérios</h2>
              <div className="flex flex-wrap gap-2">
                {member.ministryMembers.map((mm: any) => (
                  <span key={mm.ministry.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: mm.ministry.color + '20', color: mm.ministry.color }}>
                    <Heart className="w-3.5 h-3.5" />
                    {mm.ministry.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          {member.groupMembers?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Grupos & Células</h2>
              <div className="space-y-2">
                {member.groupMembers.map((gm: any) => (
                  <div key={gm.group.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Users className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{gm.group.name}</p>
                      <p className="text-xs text-gray-500">{gm.role} • {gm.group.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tags */}
          {member.tags?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {member.tags.map((t: any) => (
                  <span key={t.tag.id} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: t.tag.color + '20', color: t.tag.color }}>
                    {t.tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent donations */}
          {member.donations?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Últimas Doações</h3>
              <div className="space-y-2">
                {member.donations.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm text-gray-700">{d.type === 'TITHE' ? 'Dízimo' : d.type === 'OFFERING' ? 'Oferta' : d.type}</p>
                      <p className="text-xs text-gray-500">{formatDate(d.donatedAt)}</p>
                    </div>
                    <span className="text-sm font-medium text-green-600">{formatCurrency(d.amountCents)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Family */}
          {member.familyMembers?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Família</h3>
              <div className="space-y-2">
                {member.familyMembers.map((fm: any) =>
                  fm.family.members
                    .filter((m: any) => m.member.id !== member.id)
                    .map((m: any) => (
                      <Link key={m.member.id} href={`/pessoas/${m.member.id}`} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg transition">
                        <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-700 text-xs font-semibold">{m.member.fullName.charAt(0)}</span>
                        </div>
                        <span className="text-sm text-gray-700">{m.member.fullName}</span>
                      </Link>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

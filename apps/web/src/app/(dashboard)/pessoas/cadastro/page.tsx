'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

export default function CadastroMembroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    birthDate: '',
    gender: 'NOT_INFORMED',
    maritalStatus: 'NOT_INFORMED',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
    memberSince: '',
    baptismDate: '',
    salvationDate: '',
    isVolunteer: false,
    isLeader: false,
  });

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: any = { fullName: form.fullName };
      if (form.email) payload.email = form.email;
      if (form.phone) payload.phone = form.phone;
      if (form.birthDate) payload.birthDate = form.birthDate;
      if (form.gender !== 'NOT_INFORMED') payload.gender = form.gender;
      if (form.maritalStatus !== 'NOT_INFORMED') payload.maritalStatus = form.maritalStatus;
      if (form.street) payload.street = form.street;
      if (form.number) payload.number = form.number;
      if (form.complement) payload.complement = form.complement;
      if (form.neighborhood) payload.neighborhood = form.neighborhood;
      if (form.city) payload.city = form.city;
      if (form.state) payload.state = form.state;
      if (form.zipCode) payload.zipCode = form.zipCode;
      if (form.memberSince) payload.memberSince = form.memberSince;
      if (form.baptismDate) payload.baptismDate = form.baptismDate;
      if (form.salvationDate) payload.salvationDate = form.salvationDate;
      payload.isVolunteer = form.isVolunteer;
      payload.isLeader = form.isLeader;

      await api.post('/members', payload);
      router.push('/pessoas');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao cadastrar membro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pessoas" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Membro</h1>
          <p className="text-gray-500 mt-1">Cadastre um novo membro da igreja</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados pessoais */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados Pessoais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
              <input type="text" value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="Nome completo" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="email@exemplo.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone/WhatsApp</label>
              <input type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de nascimento</label>
              <input type="date" value={form.birthDate} onChange={(e) => updateField('birthDate', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gênero</label>
              <select value={form.gender} onChange={(e) => updateField('gender', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                <option value="NOT_INFORMED">Não informado</option>
                <option value="MALE">Masculino</option>
                <option value="FEMALE">Feminino</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado civil</label>
              <select value={form.maritalStatus} onChange={(e) => updateField('maritalStatus', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                <option value="NOT_INFORMED">Não informado</option>
                <option value="SINGLE">Solteiro(a)</option>
                <option value="MARRIED">Casado(a)</option>
                <option value="DIVORCED">Divorciado(a)</option>
                <option value="WIDOWED">Viúvo(a)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Endereço</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rua</label>
              <input type="text" value={form.street} onChange={(e) => updateField('street', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
              <input type="text" value={form.number} onChange={(e) => updateField('number', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
              <input type="text" value={form.complement} onChange={(e) => updateField('complement', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
              <input type="text" value={form.neighborhood} onChange={(e) => updateField('neighborhood', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
              <input type="text" value={form.zipCode} onChange={(e) => updateField('zipCode', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="00000-000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
              <input type="text" value={form.city} onChange={(e) => updateField('city', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select value={form.state} onChange={(e) => updateField('state', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                <option value="">Selecione</option>
                <option value="AC">AC</option><option value="AL">AL</option><option value="AP">AP</option>
                <option value="AM">AM</option><option value="BA">BA</option><option value="CE">CE</option>
                <option value="DF">DF</option><option value="ES">ES</option><option value="GO">GO</option>
                <option value="MA">MA</option><option value="MT">MT</option><option value="MS">MS</option>
                <option value="MG">MG</option><option value="PA">PA</option><option value="PB">PB</option>
                <option value="PR">PR</option><option value="PE">PE</option><option value="PI">PI</option>
                <option value="RJ">RJ</option><option value="RN">RN</option><option value="RS">RS</option>
                <option value="RO">RO</option><option value="RR">RR</option><option value="SC">SC</option>
                <option value="SP">SP</option><option value="SE">SE</option><option value="TO">TO</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dados da igreja */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados da Igreja</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Membro desde</label>
              <input type="date" value={form.memberSince} onChange={(e) => updateField('memberSince', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data do batismo</label>
              <input type="date" value={form.baptismDate} onChange={(e) => updateField('baptismDate', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data da salvação</label>
              <input type="date" value={form.salvationDate} onChange={(e) => updateField('salvationDate', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div className="flex gap-6 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isVolunteer} onChange={(e) => updateField('isVolunteer', e.target.checked)} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
              <span className="text-sm text-gray-700">É voluntário</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isLeader} onChange={(e) => updateField('isLeader', e.target.checked)} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
              <span className="text-sm text-gray-700">É líder</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-6 rounded-lg transition disabled:opacity-50">
            {loading ? 'Salvando...' : 'Cadastrar Membro'}
          </button>
          <Link href="/pessoas" className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-6 rounded-lg transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function CadastroKidsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    birthDate: '',
    gender: 'NOT_INFORMED',
    ageGroup: '',
    parentName: '',
    parentPhone: '',
    allergies: '',
    medicalNotes: '',
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/kids/children', {
        ...form,
        birthDate: form.birthDate || undefined,
        allergies: form.allergies || undefined,
        medicalNotes: form.medicalNotes || undefined,
        ageGroup: form.ageGroup || undefined,
      });
      router.push('/kids');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao cadastrar criança');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/kids" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cadastrar Criança</h1>
          <p className="text-gray-500 mt-1">Preencha os dados da criança e do responsável</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Dados da criança */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados da Criança</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="Nome da criança"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de nascimento</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => updateField('birthDate', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gênero</label>
              <select
                value={form.gender}
                onChange={(e) => updateField('gender', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="NOT_INFORMED">Não informado</option>
                <option value="MALE">Masculino</option>
                <option value="FEMALE">Feminino</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Faixa etária</label>
              <select
                value={form.ageGroup}
                onChange={(e) => updateField('ageGroup', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">Selecione</option>
                <option value="baby">Berçário (0-1 ano)</option>
                <option value="toddler">Maternal (1-3 anos)</option>
                <option value="preschool">Pré-escola (3-5 anos)</option>
                <option value="elementary">Fundamental (6-11 anos)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alergias</label>
              <input
                type="text"
                value={form.allergies}
                onChange={(e) => updateField('allergies', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="Ex: Amendoim, lactose"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações médicas</label>
              <textarea
                value={form.medicalNotes}
                onChange={(e) => updateField('medicalNotes', e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                placeholder="Medicamentos, condições especiais..."
              />
            </div>
          </div>
        </div>

        {/* Dados do responsável */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Responsável</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do responsável *</label>
              <input
                type="text"
                value={form.parentName}
                onChange={(e) => updateField('parentName', e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone/WhatsApp *</label>
              <input
                type="tel"
                value={form.parentPhone}
                onChange={(e) => updateField('parentPhone', e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-6 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Cadastrar Criança'}
          </button>
          <Link
            href="/kids"
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-6 rounded-lg transition"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

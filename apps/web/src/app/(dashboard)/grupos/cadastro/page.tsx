'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

export default function CadastroGrupoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'CELL',
    meetingDay: '',
    meetingTime: '',
    address: '',
    maxMembers: '',
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/groups', {
        name: form.name,
        description: form.description || undefined,
        type: form.type,
        meetingDay: form.meetingDay || undefined,
        meetingTime: form.meetingTime || undefined,
        address: form.address || undefined,
        maxMembers: form.maxMembers ? parseInt(form.maxMembers) : undefined,
      });
      router.push('/grupos');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar grupo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/grupos" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Grupo</h1>
          <p className="text-gray-500 mt-1">Crie uma célula, grupo de discipulado ou estudo</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do grupo *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            placeholder="Ex: Célula Vida Nova"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <select
            value={form.type}
            onChange={(e) => updateField('type', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          >
            <option value="CELL">Célula</option>
            <option value="DISCIPLESHIP">Discipulado</option>
            <option value="MINISTRY_GROUP">Grupo de Ministério</option>
            <option value="COURSE_GROUP">Grupo de Curso</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
            placeholder="Descreva o propósito deste grupo..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dia da reunião</label>
            <select
              value={form.meetingDay}
              onChange={(e) => updateField('meetingDay', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="">Selecione</option>
              <option value="Segunda-feira">Segunda-feira</option>
              <option value="Terça-feira">Terça-feira</option>
              <option value="Quarta-feira">Quarta-feira</option>
              <option value="Quinta-feira">Quinta-feira</option>
              <option value="Sexta-feira">Sexta-feira</option>
              <option value="Sábado">Sábado</option>
              <option value="Domingo">Domingo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
            <input
              type="time"
              value={form.meetingTime}
              onChange={(e) => updateField('meetingTime', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => updateField('address', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            placeholder="Local da reunião"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Máximo de membros</label>
          <input
            type="number"
            value={form.maxMembers}
            onChange={(e) => updateField('maxMembers', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            placeholder="Deixe vazio para ilimitado"
            min="1"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-6 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Criando...' : 'Criar Grupo'}
          </button>
          <Link
            href="/grupos"
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-6 rounded-lg transition"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

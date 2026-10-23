'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

export default function NovoCursoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    mode: 'presential',
    maxStudents: '',
    startAt: '',
    endAt: '',
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/school/courses', {
        name: form.name,
        description: form.description || undefined,
        category: form.category || undefined,
        mode: form.mode,
        maxStudents: form.maxStudents ? parseInt(form.maxStudents) : undefined,
        startAt: form.startAt || undefined,
        endAt: form.endAt || undefined,
      });
      router.push('/escola');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar curso');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/escola" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Curso</h1>
          <p className="text-gray-500 mt-1">Crie um curso ou trilha de aprendizado</p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do curso *</label>
          <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="Ex: Escola de Líderes" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
          <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none" placeholder="Sobre o que é este curso..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <input type="text" value={form.category} onChange={(e) => updateField('category', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="Ex: Liderança" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modalidade</label>
            <select value={form.mode} onChange={(e) => updateField('mode', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="presential">Presencial</option>
              <option value="online">Online</option>
              <option value="hybrid">Híbrido</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Máx. alunos</label>
            <input type="number" value={form.maxStudents} onChange={(e) => updateField('maxStudents', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" min="1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
            <input type="date" value={form.startAt} onChange={(e) => updateField('startAt', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Término</label>
            <input type="date" value={form.endAt} onChange={(e) => updateField('endAt', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-6 rounded-lg transition disabled:opacity-50">
            {loading ? 'Criando...' : 'Criar Curso'}
          </button>
          <Link href="/escola" className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-6 rounded-lg transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

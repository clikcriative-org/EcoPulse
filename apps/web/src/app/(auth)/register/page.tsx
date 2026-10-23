'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    churchName: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/register', form);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('tenant', JSON.stringify(data.tenant));
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Cadastre sua igreja</h2>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Seu nome
          </label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            placeholder="Pastor João"
          />
        </div>

        <div>
          <label htmlFor="churchName" className="block text-sm font-medium text-gray-700 mb-1">
            Nome da igreja
          </label>
          <input
            id="churchName"
            type="text"
            value={form.churchName}
            onChange={(e) => updateField('churchName', e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            placeholder="Igreja Vida Nova"
          />
        </div>

        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">
            E-mail
          </label>
          <input
            id="reg-email"
            type="email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            placeholder="seu@email.com"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            WhatsApp (opcional)
          </label>
          <input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            placeholder="+55 62 98283-9761"
          />
        </div>

        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">
            Senha
          </label>
          <input
            id="reg-password"
            type="password"
            value={form.password}
            onChange={(e) => updateField('password', e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600 mt-6">
        Já tem conta?{' '}
        <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
          Entrar
        </Link>
      </p>
    </div>
  );
}

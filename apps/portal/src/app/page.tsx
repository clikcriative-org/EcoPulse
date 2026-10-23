'use client';

import { useState } from 'react';

export default function PortalPage() {
  const [form, setForm] = useState({ name: '', phone: '', isFirstVisit: true });
  const [submitted, setSubmitted] = useState(false);

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: POST to API /portal/checkin
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Conectado!</h1>
          <p className="text-gray-600">Bem-vindo! Você já pode navegar na internet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-xl">E</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Bem-vindo!</h1>
          <p className="text-gray-500 text-sm mt-1">Preencha para conectar ao Wi-Fi</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome completo
            </label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Seu nome"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp
            </label>
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="firstVisit"
              type="checkbox"
              checked={form.isFirstVisit}
              onChange={(e) => updateField('isFirstVisit', e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
            />
            <label htmlFor="firstVisit" className="text-sm text-gray-700">
              É minha primeira visita
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg transition text-sm"
          >
            Conectar ao Wi-Fi
          </button>

          <p className="text-xs text-gray-400 text-center">
            Ao conectar, você concorda com nossa política de privacidade (LGPD).
          </p>
        </form>
      </div>
    </div>
  );
}

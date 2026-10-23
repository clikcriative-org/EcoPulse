'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

export default function NovaDoacaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    amount: '',
    type: 'TITHE',
    paymentMethod: 'PIX',
    donorName: '',
    notes: '',
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const amountCents = Math.round(parseFloat(form.amount.replace(',', '.')) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setError('Valor inválido');
      setLoading(false);
      return;
    }

    try {
      await api.post('/donations', {
        amountCents,
        type: form.type,
        paymentMethod: form.paymentMethod,
        donorName: form.donorName || undefined,
        notes: form.notes || undefined,
      });
      router.push('/doacoes');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao registrar doação');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/doacoes" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Doação</h1>
          <p className="text-gray-500 mt-1">Registre um dízimo, oferta ou contribuição</p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
          <input
            type="text"
            value={form.amount}
            onChange={(e) => updateField('amount', e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-2xl font-bold text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            placeholder="0,00"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select value={form.type} onChange={(e) => updateField('type', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="TITHE">Dízimo</option>
              <option value="OFFERING">Oferta</option>
              <option value="CAMPAIGN">Campanha</option>
              <option value="SPECIAL">Especial</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pagamento</label>
            <select value={form.paymentMethod} onChange={(e) => updateField('paymentMethod', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="PIX">Pix</option>
              <option value="CREDIT_CARD">Cartão de Crédito</option>
              <option value="DEBIT_CARD">Cartão de Débito</option>
              <option value="BANK_TRANSFER">Transferência</option>
              <option value="CASH">Dinheiro</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do doador (opcional)</label>
          <input type="text" value={form.donorName} onChange={(e) => updateField('donorName', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="Deixe vazio para anônimo" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
          <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={2} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-6 rounded-lg transition disabled:opacity-50">
            {loading ? 'Registrando...' : 'Registrar Doação'}
          </button>
          <Link href="/doacoes" className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-6 rounded-lg transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

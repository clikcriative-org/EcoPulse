'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Target } from 'lucide-react';
import { api } from '@/lib/api';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  goalCents: number | null;
  raisedCents: number;
  startAt: string;
  endAt: string | null;
  _count: { donations: number };
}

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', goalAmount: '', startAt: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    try {
      const { data } = await api.get('/donations/campaigns');
      setCampaigns(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const goalCents = form.goalAmount ? Math.round(parseFloat(form.goalAmount.replace(',', '.')) * 100) : undefined;
      await api.post('/donations/campaigns', {
        name: form.name,
        description: form.description || undefined,
        goalCents,
        startAt: form.startAt || new Date().toISOString().split('T')[0],
      });
      setShowCreate(false);
      setForm({ name: '', description: '', goalAmount: '', startAt: '' });
      loadCampaigns();
    } catch (err: any) { alert(err.response?.data?.message || 'Erro'); }
    finally { setCreating(false); }
  }

  function formatCurrency(cents: number) {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function progress(raised: number, goal: number | null) {
    if (!goal) return 0;
    return Math.min(100, Math.round((raised / goal) * 100));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/doacoes" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="text-gray-500 mt-1">Campanhas de arrecadação com metas</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova Campanha
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Carregando...</div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Nenhuma campanha criada</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => {
            const pct = progress(c.raisedCents, c.goalCents);
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{c.name}</h3>
                    {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Arrecadado</span>
                    <span className="font-bold text-green-600">{formatCurrency(c.raisedCents)}</span>
                  </div>
                  {c.goalCents && (
                    <>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div className="bg-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{pct}%</span>
                        <span>Meta: {formatCurrency(c.goalCents)}</span>
                      </div>
                    </>
                  )}
                  <p className="text-xs text-gray-400">{c._count.donations} doações</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nova Campanha</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="Ex: Construção do Templo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meta (R$)</label>
                <input type="text" value={form.goalAmount} onChange={(e) => setForm({ ...form, goalAmount: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="100000,00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de início</label>
                <input type="date" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={creating} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50">
                  {creating ? 'Criando...' : 'Criar Campanha'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

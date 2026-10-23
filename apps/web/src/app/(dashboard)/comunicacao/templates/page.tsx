'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, FileText, MessageSquare, Mail, Smartphone } from 'lucide-react';
import { api } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  channel: string;
  content: any;
  variables: string[];
  createdAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', channel: 'whatsapp', body: '', variables: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const { data } = await api.get('/communication/templates');
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/communication/templates', {
        name: form.name,
        channel: form.channel,
        content: { body: form.body },
        variables: form.variables ? form.variables.split(',').map((v) => v.trim()) : [],
      });
      setShowCreate(false);
      setForm({ name: '', channel: 'whatsapp', body: '', variables: '' });
      loadTemplates();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao criar template');
    } finally {
      setCreating(false);
    }
  }

  const channelIcon: Record<string, any> = {
    whatsapp: MessageSquare,
    email: Mail,
    sms: Smartphone,
  };

  const channelColor: Record<string, string> = {
    whatsapp: 'bg-green-50 text-green-700',
    email: 'bg-blue-50 text-blue-700',
    sms: 'bg-orange-50 text-orange-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/comunicacao" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-500 mt-1">Modelos de mensagem reutilizáveis</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Template
        </button>
      </div>

      {/* Templates list */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Carregando...</div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>Nenhum template criado ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => {
            const Icon = channelIcon[tpl.channel] || FileText;
            return (
              <div key={tpl.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${channelColor[tpl.channel] || 'bg-gray-50 text-gray-600'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{tpl.name}</h3>
                      <span className="text-xs text-gray-500 capitalize">{tpl.channel}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 line-clamp-3 font-mono">
                  {tpl.content?.body || JSON.stringify(tpl.content)}
                </p>
                {tpl.variables && (tpl.variables as string[]).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(tpl.variables as string[]).map((v) => (
                      <span key={v} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Novo Template</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Ex: Boas-vindas"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
                <select
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem *</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  required
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none font-mono text-sm"
                  placeholder="Olá {{nome}}, seja bem-vindo à {{igreja}}!"
                />
                <p className="text-xs text-gray-400 mt-1">Use {"{{variavel}}"} para campos dinâmicos</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variáveis (separadas por vírgula)</label>
                <input
                  type="text"
                  value={form.variables}
                  onChange={(e) => setForm({ ...form, variables: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="nome, igreja"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={creating} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50">
                  {creating ? 'Criando...' : 'Criar Template'}
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

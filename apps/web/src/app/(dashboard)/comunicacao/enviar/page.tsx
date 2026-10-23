'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Search, X } from 'lucide-react';
import { api } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  channel: string;
  content: any;
}

interface Recipient {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
}

export default function EnviarMensagemPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [channel, setChannel] = useState('whatsapp');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Recipient[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; total: number } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, [channel]);

  async function loadTemplates() {
    try {
      const { data } = await api.get('/communication/templates', { params: { channel } });
      setTemplates(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function searchMembers(query: string) {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const { data } = await api.get('/members', { params: { search: query, limit: 10 } });
      const existingIds = new Set(recipients.map((r) => r.id));
      setSearchResults(data.data.filter((m: any) => !existingIds.has(m.id)));
    } catch (err) {
      console.error(err);
    }
  }

  function addRecipient(member: Recipient) {
    setRecipients((prev) => [...prev, member]);
    setSearchQuery('');
    setSearchResults([]);
  }

  function removeRecipient(id: string) {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (recipients.length === 0) {
      alert('Adicione pelo menos um destinatário');
      return;
    }

    setSending(true);
    try {
      const payload: any = {
        channel,
        recipientIds: recipients.map((r) => r.id),
        recipientType: 'member',
      };

      if (selectedTemplate) {
        payload.templateId = selectedTemplate;
      } else {
        payload.content = { body: customMessage };
      }

      const { data } = await api.post('/communication/send', payload);
      setResult(data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao enviar');
    } finally {
      setSending(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Send className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Mensagens Enviadas!</h2>
        <p className="text-gray-600 mb-6">
          {result.sent} de {result.total} mensagen{result.total !== 1 ? 's' : ''} na fila de envio.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/comunicacao" className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-6 rounded-lg transition">
            Ver Histórico
          </Link>
          <button onClick={() => { setResult(null); setRecipients([]); }} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-6 rounded-lg transition">
            Enviar Outra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/comunicacao" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enviar Mensagem</h1>
          <p className="text-gray-500 mt-1">Envie mensagens para membros da igreja</p>
        </div>
      </div>

      <form onSubmit={handleSend} className="space-y-6">
        {/* Channel */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Canal</h2>
          <div className="flex gap-3">
            {[
              { key: 'whatsapp', label: 'WhatsApp' },
              { key: 'email', label: 'E-mail' },
              { key: 'sms', label: 'SMS' },
            ].map((ch) => (
              <button
                key={ch.key}
                type="button"
                onClick={() => { setChannel(ch.key); setSelectedTemplate(''); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  channel === ch.key
                    ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-200'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recipients */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Destinatários</h2>

          {/* Selected recipients */}
          {recipients.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {recipients.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-sm">
                  {r.fullName}
                  <button type="button" onClick={() => removeRecipient(r.id)} className="hover:text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => searchMembers(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Buscar membros para adicionar..."
            />
          </div>

          {searchResults.length > 0 && (
            <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
              {searchResults.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => addRecipient(member)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 transition text-left"
                >
                  <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 text-xs font-semibold">{member.fullName.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.fullName}</p>
                    <p className="text-xs text-gray-500">{channel === 'email' ? member.email : member.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message content */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Mensagem</h2>

          {/* Template selector */}
          {templates.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">Usar template:</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">Mensagem personalizada</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Custom message */}
          {!selectedTemplate && (
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={5}
              required={!selectedTemplate}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              placeholder="Digite sua mensagem aqui..."
            />
          )}
        </div>

        {/* Send */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={sending || recipients.length === 0}
            className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-6 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Enviando...' : `Enviar para ${recipients.length} pessoa${recipients.length !== 1 ? 's' : ''}`}
          </button>
          <Link href="/comunicacao" className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-6 rounded-lg transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

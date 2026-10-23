'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare, Send, FileText, Bell, CheckCircle, Clock, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface Stats {
  totalSent: number;
  totalQueued: number;
  totalFailed: number;
  totalTemplates: number;
  byChannel: { channel: string; count: number }[];
}

interface Message {
  id: string;
  channel: string;
  to: string;
  status: string;
  createdAt: string;
  template: { name: string } | null;
}

export default function ComunicacaoPage() {
  const [stats, setStats] = useState<Stats>({ totalSent: 0, totalQueued: 0, totalFailed: 0, totalTemplates: 0, byChannel: [] });
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [statsRes, messagesRes] = await Promise.all([
        api.get('/communication/stats'),
        api.get('/communication/messages', { params: { limit: 20 } }),
      ]);
      setStats(statsRes.data);
      setMessages(messagesRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const channelLabel: Record<string, string> = {
    whatsapp: 'WhatsApp',
    email: 'E-mail',
    sms: 'SMS',
  };

  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    QUEUED: { icon: Clock, color: 'text-yellow-600 bg-yellow-50', label: 'Na fila' },
    SENT: { icon: CheckCircle, color: 'text-green-600 bg-green-50', label: 'Enviado' },
    DELIVERED: { icon: CheckCircle, color: 'text-blue-600 bg-blue-50', label: 'Entregue' },
    READ: { icon: CheckCircle, color: 'text-purple-600 bg-purple-50', label: 'Lido' },
    FAILED: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Falhou' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comunicação</h1>
          <p className="text-gray-500 mt-1">WhatsApp, e-mail e notificações</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/comunicacao/enviar"
            className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Enviar Mensagem
          </Link>
          <Link
            href="/comunicacao/templates"
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Templates
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSent}</p>
              <p className="text-xs text-gray-500">Enviadas</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalQueued}</p>
              <p className="text-xs text-gray-500">Na fila</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalFailed}</p>
              <p className="text-xs text-gray-500">Falharam</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTemplates}</p>
              <p className="text-xs text-gray-500">Templates</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages by channel */}
      {stats.byChannel.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Por Canal</h2>
          <div className="flex gap-6">
            {stats.byChannel.map((c) => (
              <div key={c.channel} className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">{channelLabel[c.channel] || c.channel}:</span>
                <span className="text-sm text-gray-900 font-bold">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent messages */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Mensagens Recentes</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Nenhuma mensagem enviada ainda
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Canal</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Destinatário</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Template</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {messages.map((msg) => {
                const status = statusConfig[msg.status] || statusConfig.QUEUED;
                const StatusIcon = status.icon;
                return (
                  <tr key={msg.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {channelLabel[msg.channel] || msg.channel}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700 font-mono">{msg.to}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{msg.template?.name || '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">
                      {new Date(msg.createdAt).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

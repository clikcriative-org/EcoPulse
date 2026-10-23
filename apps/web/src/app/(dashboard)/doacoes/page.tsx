'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { HandCoins, Plus, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { api } from '@/lib/api';

interface Stats {
  thisMonthTotal: number;
  lastMonthTotal: number;
  growth: number;
  tithesThisMonth: number;
  offeringsThisMonth: number;
  donationsCount: number;
  uniqueDonors: number;
}

interface Donation {
  id: string;
  type: string;
  amountCents: number;
  paymentMethod: string;
  paymentStatus: string;
  donatedAt: string;
  member: { id: string; fullName: string } | null;
  campaign: { id: string; name: string } | null;
}

export default function DoacoesPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [statsRes, donationsRes] = await Promise.all([
        api.get('/donations/stats'),
        api.get('/donations', { params: { limit: 20 } }),
      ]);
      setStats(statsRes.data);
      setDonations(donationsRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(cents: number) {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const typeLabel: Record<string, string> = { TITHE: 'Dízimo', OFFERING: 'Oferta', CAMPAIGN: 'Campanha', SPECIAL: 'Especial' };
  const methodLabel: Record<string, string> = { PIX: 'Pix', CREDIT_CARD: 'Cartão Crédito', DEBIT_CARD: 'Cartão Débito', BANK_TRANSFER: 'Transferência', CASH: 'Dinheiro' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doações</h1>
          <p className="text-gray-500 mt-1">Dízimos, ofertas e campanhas</p>
        </div>
        <div className="flex gap-3">
          <Link href="/doacoes/nova" className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nova Doação
          </Link>
          <Link href="/doacoes/campanhas" className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition flex items-center gap-2">
            <Target className="w-4 h-4" />
            Campanhas
          </Link>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Total do Mês</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.thisMonthTotal)}</p>
            <div className="flex items-center gap-1 mt-2 text-xs">
              {stats.growth >= 0 ? (
                <><TrendingUp className="w-3 h-3 text-green-500" /><span className="text-green-600">+{stats.growth}%</span></>
              ) : (
                <><TrendingDown className="w-3 h-3 text-red-500" /><span className="text-red-600">{stats.growth}%</span></>
              )}
              <span className="text-gray-400">vs. mês anterior</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Dízimos</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(stats.tithesThisMonth)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Ofertas</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats.offeringsThisMonth)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Doadores Únicos</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{stats.uniqueDonors}</p>
            <p className="text-xs text-gray-400 mt-2">{stats.donationsCount} doações</p>
          </div>
        </div>
      )}

      {/* Donations table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Últimas Doações</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : donations.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhuma doação registrada ainda</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Doador</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Método</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {donations.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900">{d.member?.fullName || 'Anônimo'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{typeLabel[d.type] || d.type}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{methodLabel[d.paymentMethod] || d.paymentMethod}</td>
                  <td className="px-6 py-3 text-sm font-medium text-green-600 text-right">{formatCurrency(d.amountCents)}</td>
                  <td className="px-6 py-3 text-xs text-gray-500">{new Date(d.donatedAt).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

'use client';

import { Users, Heart, UsersRound, Calendar, HandCoins, TrendingUp } from 'lucide-react';

const stats = [
  { name: 'Total de Membros', value: '0', icon: Users, color: 'bg-blue-50 text-blue-600' },
  { name: 'Voluntários', value: '0', icon: Heart, color: 'bg-green-50 text-green-600' },
  { name: 'Líderes', value: '0', icon: UsersRound, color: 'bg-purple-50 text-purple-600' },
  { name: 'Ministérios', value: '0', icon: Calendar, color: 'bg-orange-50 text-orange-600' },
  { name: 'Grupos/Células', value: '0', icon: UsersRound, color: 'bg-pink-50 text-pink-600' },
  { name: 'Doações (mês)', value: 'R$ 0', icon: HandCoins, color: 'bg-emerald-50 text-emerald-600' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Visão geral da sua igreja</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span className="text-green-600 font-medium">—</span>
              <span>vs. mês anterior</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Atividade Recente</h2>
          <div className="text-center py-8 text-gray-400">
            <p>Nenhuma atividade ainda</p>
            <p className="text-sm mt-1">Comece cadastrando membros da sua igreja</p>
          </div>
        </div>

        {/* Birthdays */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Aniversariantes do Mês</h2>
          <div className="text-center py-8 text-gray-400">
            <p>Nenhum aniversariante</p>
            <p className="text-sm mt-1">Cadastre membros com data de nascimento</p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Baby, LogOut, Clock, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Child {
  id: string;
  fullName: string;
  ageGroup: string | null;
  parentName: string;
  parentPhone: string;
  allergies: string | null;
  photoUrl: string | null;
}

interface ActiveCheckIn {
  id: string;
  checkInAt: string;
  securityCode: string;
  room: string | null;
  child: {
    id: string;
    fullName: string;
    ageGroup: string | null;
    parentName: string;
    parentPhone: string;
    allergies: string | null;
  };
}

export default function CheckInPage() {
  const [tab, setTab] = useState<'checkin' | 'presentes'>('checkin');
  const [children, setChildren] = useState<Child[]>([]);
  const [activeCheckIns, setActiveCheckIns] = useState<ActiveCheckIn[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkInResult, setCheckInResult] = useState<{ code: string; name: string } | null>(null);
  const [checkOutModal, setCheckOutModal] = useState<ActiveCheckIn | null>(null);
  const [checkOutCode, setCheckOutCode] = useState('');
  const [checkOutBy, setCheckOutBy] = useState('');
  const [checkOutError, setCheckOutError] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [childrenRes, activeRes] = await Promise.all([
        api.get('/kids/children'),
        api.get('/kids/active'),
      ]);
      setChildren(childrenRes.data);
      setActiveCheckIns(activeRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn(childId: string) {
    try {
      const { data } = await api.post('/kids/checkin', {
        childId,
        room: selectedRoom || undefined,
      });
      setCheckInResult({ code: data.securityCode, name: data.child.fullName });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao fazer check-in');
    }
  }

  async function handleCheckOut() {
    if (!checkOutModal) return;
    setCheckOutError('');

    try {
      await api.post(`/kids/checkout/${checkOutModal.id}`, {
        securityCode: checkOutCode.toUpperCase(),
        checkedOutBy: checkOutBy,
      });
      setCheckOutModal(null);
      setCheckOutCode('');
      setCheckOutBy('');
      loadData();
    } catch (err: any) {
      setCheckOutError(err.response?.data?.message || 'Código inválido');
    }
  }

  const filteredChildren = children.filter((c) =>
    c.fullName.toLowerCase().includes(search.toLowerCase())
  );

  // Children that are NOT currently checked in
  const checkedInIds = new Set(activeCheckIns.map((ci) => ci.child.id));
  const availableForCheckIn = filteredChildren.filter((c) => !checkedInIds.has(c.id));

  function timeSince(dateStr: string) {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/kids" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Check-in Kids</h1>
          <p className="text-gray-500 mt-1">
            {activeCheckIns.length} criança{activeCheckIns.length !== 1 ? 's' : ''} presente{activeCheckIns.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('checkin')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            tab === 'checkin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Baby className="w-4 h-4 inline mr-2" />
          Check-in
        </button>
        <button
          onClick={() => setTab('presentes')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            tab === 'presentes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 inline mr-2" />
          Presentes ({activeCheckIns.length})
        </button>
      </div>

      {/* Check-in result modal */}
      {checkInResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Check-in Realizado!</h2>
            <p className="text-gray-600 mb-4">{checkInResult.name}</p>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-500 mb-1">Código de Segurança</p>
              <p className="text-3xl font-mono font-bold text-primary-600 tracking-widest">
                {checkInResult.code}
              </p>
            </div>
            <p className="text-xs text-gray-500 mb-6">
              Guarde este código. Será necessário para o check-out.
            </p>
            <button
              onClick={() => setCheckInResult(null)}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg transition"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Check-out modal */}
      {checkOutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Check-out</h2>
            <p className="text-gray-600 text-sm mb-4">{checkOutModal.child.fullName}</p>

            {checkOutError && (
              <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">{checkOutError}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de segurança</label>
                <input
                  type="text"
                  value={checkOutCode}
                  onChange={(e) => setCheckOutCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-center text-xl font-mono tracking-widest focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="______"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Retirado por</label>
                <input
                  type="text"
                  value={checkOutBy}
                  onChange={(e) => setCheckOutBy(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Nome de quem está retirando"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCheckOut}
                disabled={!checkOutCode || !checkOutBy}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
              >
                Confirmar
              </button>
              <button
                onClick={() => { setCheckOutModal(null); setCheckOutCode(''); setCheckOutBy(''); setCheckOutError(''); }}
                className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab content */}
      {tab === 'checkin' && (
        <div className="space-y-4">
          {/* Room selector */}
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar criança..."
              className="flex-1 max-w-md px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="">Sala (opcional)</option>
              <option value="Berçário">Berçário</option>
              <option value="Maternal">Maternal</option>
              <option value="Pré-escola">Pré-escola</option>
              <option value="Fundamental">Fundamental</option>
            </select>
          </div>

          {/* Available children */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableForCheckIn.map((child) => (
              <div key={child.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                      <span className="text-pink-600 font-semibold">{child.fullName.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{child.fullName}</p>
                      <p className="text-xs text-gray-500">{child.parentName}</p>
                    </div>
                  </div>
                </div>
                {child.allergies && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                    <AlertTriangle className="w-3 h-3" />
                    {child.allergies}
                  </div>
                )}
                <button
                  onClick={() => handleCheckIn(child.id)}
                  className="mt-3 w-full bg-primary-50 hover:bg-primary-100 text-primary-700 font-medium py-2 rounded-lg transition text-sm"
                >
                  Fazer Check-in
                </button>
              </div>
            ))}
          </div>

          {availableForCheckIn.length === 0 && !loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              {children.length === 0
                ? 'Cadastre crianças para fazer check-in'
                : 'Todas as crianças já estão com check-in ativo'}
            </div>
          )}
        </div>
      )}

      {tab === 'presentes' && (
        <div className="space-y-3">
          {activeCheckIns.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              Nenhuma criança presente no momento
            </div>
          ) : (
            activeCheckIns.map((ci) => (
              <div key={ci.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Baby className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{ci.child.fullName}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeSince(ci.checkInAt)}
                      </span>
                      {ci.room && <span>• {ci.room}</span>}
                      <span>• Resp: {ci.child.parentName}</span>
                    </div>
                    {ci.child.allergies && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 mt-1">
                        <AlertTriangle className="w-3 h-3" />
                        {ci.child.allergies}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setCheckOutModal(ci)}
                  className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium py-2 px-4 rounded-lg transition text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Check-out
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

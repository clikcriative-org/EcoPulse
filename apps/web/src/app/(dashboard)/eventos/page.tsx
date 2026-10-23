export default function EventosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Eventos</h1>
          <p className="text-gray-500 mt-1">Calendário de cultos, conferências e encontros</p>
        </div>
        <button className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition">
          + Novo Evento
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-400">Nenhum evento cadastrado ainda</p>
      </div>
    </div>
  );
}

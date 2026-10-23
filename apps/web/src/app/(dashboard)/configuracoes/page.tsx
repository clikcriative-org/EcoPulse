export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 mt-1">Personalize sua igreja na plataforma</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados da Igreja</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Igreja</label>
              <input type="text" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cor Principal</label>
              <input type="color" defaultValue="#10b981" className="w-12 h-10 rounded border border-gray-300 cursor-pointer" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Plano Atual</h2>
          <div className="text-center py-4">
            <p className="text-2xl font-bold text-primary-600">ADVANCE</p>
            <p className="text-gray-500 mt-1">Até 1.000 membros</p>
          </div>
        </div>
      </div>
    </div>
  );
}

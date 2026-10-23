export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700">eco<span className="text-gray-800">PULSE</span></h1>
          <p className="text-gray-600 mt-1">Pastoreie com clareza</p>
        </div>
        {children}
      </div>
    </div>
  );
}

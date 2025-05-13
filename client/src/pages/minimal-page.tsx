import React from 'react';

export default function MinimalPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Página Mínima de Emergencia</h1>
      <p className="text-gray-600 mb-6">Esta es una página de emergencia mientras se resuelven los problemas del sistema.</p>
      
      <div className="p-4 border border-yellow-500 bg-yellow-50 rounded-md max-w-md">
        <p>El sistema está experimentando dificultades técnicas. Por favor, intente nuevamente en unos minutos.</p>
      </div>
    </div>
  );
}
import React from 'react';

interface ProductoStatusIndicatorProps {
  codigo: string;
  recolectado: number | null;
  cantidad: number;
  motivo?: string | null;
  mostrarCodigo?: boolean;
}

/**
 * Componente para mostrar de manera consistente el estado de un producto
 * Evita la duplicación de mensajes de faltantes en la interfaz
 */
export function ProductoStatusIndicator({
  codigo,
  recolectado,
  cantidad,
  motivo,
  mostrarCodigo = false
}: ProductoStatusIndicatorProps) {
  // Si no hay cantidad recolectada, mostrar como no procesado
  if (recolectado === null) {
    return (
      <div className="text-gray-600">
        {mostrarCodigo && <span className="font-mono mr-1">{codigo}:</span>}
        <span>No procesado</span>
      </div>
    );
  }

  // Si está completamente recolectado
  if (recolectado === cantidad) {
    return (
      <div className="text-green-600 font-medium">
        {mostrarCodigo && <span className="font-mono mr-1">{codigo}:</span>}
        <span>Recolectado: {recolectado}/{cantidad}</span>
      </div>
    );
  }

  // Si es parcial con motivo (faltante justificado)
  if (recolectado < cantidad && motivo && motivo.trim() !== '') {
    return (
      <div>
        <div className="text-amber-600 font-medium">
          {mostrarCodigo && <span className="font-mono mr-1">{codigo}:</span>}
          <span>Recolectado: {recolectado}/{cantidad}</span>
          <span className="ml-1 text-xs bg-green-100 px-1 py-0.5 rounded">✓ Con faltante</span>
        </div>
        <div className="text-xs text-red-600 italic mt-1">
          Motivo: {motivo}
        </div>
      </div>
    );
  }

  // Si es parcial sin motivo (incompleto)
  return (
    <div className="text-orange-600 font-medium">
      {mostrarCodigo && <span className="font-mono mr-1">{codigo}:</span>}
      <span>Recolectado: {recolectado}/{cantidad}</span>
      <span className="ml-1 text-xs bg-red-100 px-1 py-0.5 rounded">Incompleto</span>
    </div>
  );
}
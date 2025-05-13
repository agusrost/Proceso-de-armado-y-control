import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ArmadoSimpleControlsProps {
  cantidadSolicitada: number;
  cantidadInicial: number;
  onCantidadChange: (cantidad: number) => void;
  necesitaMotivo: boolean;
  motivo: string;
  onMotivoChange: (motivo: string) => void;
}

export function ArmadoSimpleControls({
  cantidadSolicitada,
  cantidadInicial,
  onCantidadChange,
  necesitaMotivo,
  motivo,
  onMotivoChange
}: ArmadoSimpleControlsProps) {
  // Estado local para la cantidad mostrada
  const cantidadInicialCorrecta = cantidadInicial === 0 ? cantidadSolicitada : cantidadInicial;
  console.log(`FORZANDO cantidadInicial de ${cantidadInicial} a ${cantidadInicialCorrecta}`);
  const [cantidadLocal, setCantidadLocal] = useState(cantidadInicialCorrecta);
  const [motivoPersonalizado, setMotivoPersonalizado] = useState("");
  
  // Lista de motivos predefinidos
  const motivosPreestablecidos = [
    "Faltante de stock",
    "No se encontró el artículo",
    "Producto defectuoso",
    "Otro motivo"
  ];
  
  // Sincronizar el estado local cuando cambian las props
  useEffect(() => {
    console.log(`ArmadoSimpleControls - cantidadInicial recibida: ${cantidadInicial}, solicitada: ${cantidadSolicitada}`);
    // Si cantidadInicial es 0, usar cantidadSolicitada como valor inicial
    const valorInicial = cantidadInicial === 0 ? cantidadSolicitada : cantidadInicial;
    console.log(`Estableciendo cantidadLocal a: ${valorInicial}`);
    setCantidadLocal(valorInicial);
    onCantidadChange(valorInicial);
  }, [cantidadInicial, cantidadSolicitada]);

  // Función para decrementar la cantidad
  const decrementar = () => {
    const nuevaCantidad = Math.max(0, cantidadLocal - 1);
    setCantidadLocal(nuevaCantidad);
    onCantidadChange(nuevaCantidad);
    console.log(`Botón decrementar: ${cantidadLocal} -> ${nuevaCantidad}`);
  };

  // Función para incrementar la cantidad
  const incrementar = () => {
    const nuevaCantidad = Math.min(cantidadSolicitada, cantidadLocal + 1);
    setCantidadLocal(nuevaCantidad);
    onCantidadChange(nuevaCantidad);
    console.log(`Botón incrementar: ${cantidadLocal} -> ${nuevaCantidad}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between w-full border rounded-md">
        <Button
          type="button"
          onClick={decrementar}
          className="px-4 py-6 h-14 bg-gray-100 hover:bg-gray-200 text-black rounded-l-md flex-1 flex items-center justify-center"
        >
          <span className="text-3xl font-bold">−</span>
        </Button>
        
        <span className="text-2xl font-semibold px-6 flex-1 text-center">
          {cantidadLocal}
        </span>
        
        <Button
          type="button"
          onClick={incrementar}
          className="px-4 py-6 h-14 bg-gray-100 hover:bg-gray-200 text-black rounded-r-md flex-1 flex items-center justify-center"
        >
          <span className="text-3xl font-bold">+</span>
        </Button>
      </div>
      
      {/* Selector de motivo si la cantidad es menor a la solicitada */}
      {necesitaMotivo && cantidadLocal < cantidadSolicitada && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {cantidadLocal === 0 
              ? "Seleccione motivo para producto no recolectado:" 
              : "Seleccione motivo para faltante parcial:"}
          </label>
          <select
            className="w-full p-2 border border-gray-300 rounded-md"
            value={motivo}
            onChange={(e) => {
              onMotivoChange(e.target.value);
              if (e.target.value !== "Otro motivo") {
                setMotivoPersonalizado("");
              }
            }}
            required
          >
            <option value="">Seleccione un motivo</option>
            {motivosPreestablecidos.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          
          {motivo === "Otro motivo" && (
            <div className="mt-2 flex space-x-2">
              <Input
                type="text"
                placeholder="Especifique el motivo"
                className="p-2 border border-gray-300 rounded-md flex-grow"
                value={motivoPersonalizado}
                onChange={(e) => setMotivoPersonalizado(e.target.value)}
              />
              <Button
                type="button"
                className="bg-green-600 text-white p-2 rounded-md hover:bg-green-700 flex items-center justify-center"
                onClick={() => onMotivoChange(motivoPersonalizado)}
                disabled={!motivoPersonalizado}
              >
                ✓
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface ArmadoSimpleControlsProps {
  cantidadSolicitada: number;
  cantidadInicial: number;
  onCantidadChange: (cantidad: number) => void;
}

export function ArmadoSimpleControls({
  cantidadSolicitada,
  cantidadInicial,
  onCantidadChange
}: ArmadoSimpleControlsProps) {
  // Estado local para la cantidad mostrada
  const [cantidadLocal, setCantidadLocal] = useState(cantidadInicial);
  
  // Sincronizar el estado local cuando cambian las props
  useEffect(() => {
    setCantidadLocal(cantidadInicial);
  }, [cantidadInicial]);

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
  );
}
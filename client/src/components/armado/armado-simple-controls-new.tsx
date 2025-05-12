import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MinusCircle, PlusCircle, Save, FastForward, AlertTriangle } from "lucide-react";

type Producto = {
  id: number;
  cantidad: number;
  recolectado: number | null;
  motivo: string | null;
  codigo: string;
  descripcion: string;
};

interface ArmadoSimpleControlsNewProps {
  productos: Producto[];
  currentProductoIndex: number;
  recolectados: number | null;
  setRecolectados: (cantidad: number) => void;
  motivo: string;
  setMotivo: (motivo: string) => void;
  onGuardar: () => void;
  pausaActiva: boolean;
  onFinalizarPedido: () => void;
  mutationIsPending: boolean;
  esReanudacion: boolean;
}

export function ArmadoSimpleControlsNew({
  productos,
  currentProductoIndex,
  recolectados,
  setRecolectados,
  motivo,
  setMotivo,
  onGuardar,
  pausaActiva,
  onFinalizarPedido,
  mutationIsPending,
  esReanudacion
}: ArmadoSimpleControlsNewProps) {
  // Opciones de motivos predefinidos para faltantes
  const motivosPreestablecidos = [
    "Faltante de stock",
    "No se encontró el artículo",
    "Producto defectuoso",
    "Otro motivo"
  ];

  // Verificar si es el último producto
  const esUltimoProducto = currentProductoIndex >= productos.length - 1;
  
  // Obtener el producto actual
  const producto = productos[currentProductoIndex];
  
  // Valor seguro para recolectados
  // Si no hay un valor (null), usamos la cantidad requerida del producto
  const cantidadActual = recolectados !== null ? recolectados : (producto?.cantidad || 0);
  
  // Determinar si hay faltante parcial
  const hayFaltanteParcial = cantidadActual < (producto?.cantidad || 0) && cantidadActual > 0;
  
  // Determinar si es un faltante total
  const esFaltanteTotal = cantidadActual === 0;
  
  // Asegurar que cuando hay faltante parcial o total pero no hay motivo, se desactive el botón de guardar
  const requiereMotivo = (hayFaltanteParcial || esFaltanteTotal) && !motivo;

  // Incrementar cantidad
  const incrementar = () => {
    const nuevaCantidad = Math.min(cantidadActual + 1, producto?.cantidad || 0);
    setRecolectados(nuevaCantidad);
  };

  // Decrementar cantidad
  const decrementar = () => {
    const nuevaCantidad = Math.max(cantidadActual - 1, 0);
    setRecolectados(nuevaCantidad);
  };

  // Cambio de cantidad directamente en el input
  const cambiarCantidad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = parseInt(e.target.value, 10);
    if (!isNaN(valor)) {
      const nuevaCantidad = Math.max(0, Math.min(valor, producto?.cantidad || 0));
      setRecolectados(nuevaCantidad);
    } else {
      setRecolectados(0);
    }
  };

  if (!producto) {
    return <div className="text-center p-4">No hay productos disponibles</div>;
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Información del producto actual */}
      <div className="flex justify-between items-center text-sm text-gray-500">
        <div>
          Producto {currentProductoIndex + 1} de {productos.length}
        </div>
        {esReanudacion && (
          <div className="flex items-center gap-1 text-amber-600">
            <AlertTriangle size={16} />
            <span>Pedido reanudado</span>
          </div>
        )}
      </div>
      
      {/* Control de cantidad */}
      <div className="mb-2">
        <Label>Cantidad recolectada:</Label>
        <div className="flex items-center gap-2 mt-1">
          <Button 
            type="button" 
            variant="outline" 
            onClick={decrementar}
            disabled={cantidadActual <= 0 || pausaActiva || mutationIsPending}
          >
            <MinusCircle className="h-4 w-4" />
          </Button>
          
          <Input
            type="number"
            value={cantidadActual}
            onChange={cambiarCantidad}
            min={0}
            max={producto.cantidad}
            className="text-center w-20"
            disabled={pausaActiva || mutationIsPending}
          />
          
          <Button 
            type="button" 
            variant="outline" 
            onClick={incrementar}
            disabled={cantidadActual >= producto.cantidad || pausaActiva || mutationIsPending}
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
          
          <div className="text-gray-500 ml-1">
            / {producto.cantidad}
          </div>
        </div>
      </div>
      
      {/* Selector de motivo para faltantes (total o parcial) - Siempre visible cuando hay menos unidades que las solicitadas */}
      {(esFaltanteTotal || hayFaltanteParcial) && (
        <div className="mb-2">
          <Label className={`font-semibold ${requiereMotivo ? 'text-red-600' : 'text-amber-600'}`}>
            {esFaltanteTotal ? "Motivo de faltante total:" : "Motivo de faltante parcial:"}
          </Label>
          <Select 
            value={motivo} 
            onValueChange={setMotivo}
            disabled={pausaActiva || mutationIsPending}
          >
            <SelectTrigger className={`${motivo ? "" : "text-muted-foreground"} ${requiereMotivo ? 'border-red-300 ring-1 ring-red-200' : ''}`}>
              <SelectValue placeholder="Seleccione un motivo" />
            </SelectTrigger>
            <SelectContent>
              {motivosPreestablecidos.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {requiereMotivo && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              <span>Debe indicar un motivo cuando hay menos unidades que las solicitadas</span>
            </p>
          )}
        </div>
      )}
      
      {/* Botones de acción */}
      <div className="flex gap-2 mt-2">
        {esUltimoProducto && (
          <Button 
            onClick={onFinalizarPedido}
            disabled={pausaActiva || mutationIsPending || (hayFaltanteParcial && !motivo) || (esFaltanteTotal && !motivo)}
            className="flex-1"
            variant="primary"
          >
            <FastForward className="h-4 w-4 mr-1" />
            Finalizar
          </Button>
        )}
      </div>
    </div>
  );
}
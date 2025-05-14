import { Producto } from "@shared/schema";
import { CheckCircle2, Circle } from "lucide-react";

interface ProductoArmadoItemProps {
  producto: Producto;
  isActive: boolean;
  isCompleted: boolean;
  isPending: boolean;
}

export default function ProductoArmadoItem({
  producto,
  isActive,
  isCompleted,
  isPending,
}: ProductoArmadoItemProps) {
  // Determinar el color de fondo según el estado
  const getBgColor = () => {
    if (isCompleted) return "bg-gray-200";
    if (isActive) return "bg-green-100 border-green-500 border-2";
    if (isPending) return "bg-red-50";
    return "bg-white";
  };

  const getStatusIcon = () => {
    if (isCompleted) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    return <Circle className="h-5 w-5 text-gray-300" />;
  };

  // CORRECCIÓN CRÍTICA v2.0: Mostrar siempre la cantidad real y el indicador INCOMPLETO si aplica
  const tieneMotivo = producto.motivo && producto.motivo.trim() !== '';
  const estaIncompleto = producto.recolectado !== null && producto.recolectado < producto.cantidad;
  
  // Mostrar la cantidad recolectada vs la solicitada, con indicador INCOMPLETO si aplica
  // Garantizamos que la cantidad sea número para prevenir errores
  const cantidadRecolectada = producto.recolectado !== null ? producto.recolectado : 0;
  const cantidadDisplay = `${cantidadRecolectada}/${producto.cantidad}`;
  
  // Texto adicional para productos incompletos
  const textoIncompleto = estaIncompleto ? 
    (tieneMotivo ? " (INCOMPLETO ✓)" : " (INCOMPLETO)") : "";

  return (
    <div
      className={`p-3 rounded-md mb-2 ${getBgColor()} transition-all duration-200`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          {getStatusIcon()}
          <div className="ml-3">
            <p className="font-semibold">{producto.codigo}</p>
            <p className="text-sm truncate max-w-xs">{producto.descripcion}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex flex-col">
            <p className="font-bold">
              {cantidadDisplay}
              <span className={`ml-1 text-xs ${tieneMotivo ? 'text-blue-500' : estaIncompleto ? 'text-orange-500' : ''}`}>
                {textoIncompleto}
              </span>
            </p>
            {producto.ubicacion && (
              <p className="text-xs text-blue-700 font-medium bg-blue-50 px-2 py-1 rounded-md mt-1">{producto.ubicacion}</p>
            )}
            {/* Mostrar motivo de faltante si existe */}
            {tieneMotivo && estaIncompleto && (
              <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md mt-1 border border-amber-200">
                {producto.motivo}
              </p>
            )}
          </div>
        </div>
      </div>
      {isCompleted && cantidadRecolectada < producto.cantidad && (
        <div className="mt-1 text-xs text-red-500">
          Motivo: {producto.motivo || "No especificado"}
        </div>
      )}
    </div>
  );
}
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

  // Mostrar la cantidad recolectada vs la solicitada
  const cantidadDisplay = `${producto.recolectado || 0}/${producto.cantidad}`;

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
          <p className="font-bold">{cantidadDisplay}</p>
          {producto.ubicacion && (
            <p className="text-xs text-blue-700 font-medium bg-blue-50 px-2 py-1 rounded-md mt-1">{producto.ubicacion}</p>
          )}
        </div>
      </div>
      {isCompleted && producto.recolectado < producto.cantidad && (
        <div className="mt-1 text-xs text-red-500">
          Motivo: {producto.motivo || "No especificado"}
        </div>
      )}
    </div>
  );
}
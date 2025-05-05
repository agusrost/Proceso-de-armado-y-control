import React from "react";
import { ProductoControlado } from "@shared/types";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ShoppingBag,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ControlProductoItemProps {
  producto: ProductoControlado;
  className?: string;
  onClick?: () => void;
}

export function ControlProductoItem({ 
  producto,
  className,
  onClick
}: ControlProductoItemProps) {
  // Determinar estilos según el estado
  const getStatusStyles = () => {
    if (producto.estado === 'excedente') {
      return { 
        bgColor: 'bg-red-50 hover:bg-red-100', 
        borderColor: 'border-red-200',
        textColor: 'text-red-700',
        icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
        clickable: true // Los excedentes siempre son clickeables para retirarlos
      };
    } else if (producto.estado === 'faltante') {
      return { 
        bgColor: 'bg-yellow-50 hover:bg-yellow-100', 
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-700',
        icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
        clickable: false
      };
    } else if (producto.estado === 'correcto') {
      return { 
        bgColor: 'bg-green-50 hover:bg-green-100', 
        borderColor: 'border-green-200',
        textColor: 'text-green-700',
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        clickable: false
      };
    } else {
      return { 
        bgColor: 'bg-gray-50 hover:bg-gray-100', 
        borderColor: 'border-gray-200',
        textColor: 'text-gray-700',
        icon: <XCircle className="h-5 w-5 text-gray-400" />,
        clickable: false
      };
    }
  };

  const { bgColor, borderColor, textColor, icon, clickable } = getStatusStyles();
  
  // Si el producto tiene excedente, mostrar un mensaje informativo
  const hasExcess = producto.controlado > producto.cantidad;
  const hasDeficit = producto.controlado < producto.cantidad;
  
  return (
    <Card 
      className={cn(
        `${bgColor} border ${borderColor} transition-colors`, 
        clickable ? 'cursor-pointer' : '',
        className
      )}
      onClick={clickable ? onClick : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center">
              <ShoppingBag className="h-4 w-4 mr-2 text-gray-500" />
              <h4 className="font-medium">{producto.codigo}</h4>
            </div>
            <p className="text-sm text-gray-600 mt-1">{producto.descripcion}</p>
            
            {producto.ubicacion && (
              <div className="flex items-center mt-1 text-xs text-gray-500">
                <MapPin className="h-3 w-3 mr-1" />
                <span>{producto.ubicacion}</span>
              </div>
            )}
            
            {hasExcess && (
              <div className="mt-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-sm">
                Retirar {producto.controlado - producto.cantidad} unidad(es)
                {clickable && (
                  <span className="block font-medium">Click para confirmar retiro</span>
                )}
              </div>
            )}
            
            {hasDeficit && (
              <div className="mt-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-sm">
                Faltante: {producto.cantidad - producto.controlado} unidad(es)
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-end space-y-1">
            <div className="flex items-center">
              {icon}
              <span className={`ml-1 font-bold text-lg ${textColor}`}>
                {producto.controlado}/{producto.cantidad}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
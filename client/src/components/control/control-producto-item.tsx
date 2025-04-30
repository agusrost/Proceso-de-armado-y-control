import { ProductoControlado } from "@shared/types";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";

interface ControlProductoItemProps {
  producto: ProductoControlado;
  className?: string;
}

export function ControlProductoItem({ 
  producto, 
  className = "" 
}: ControlProductoItemProps) {
  // Determinar estado
  const estado = producto.controlado < producto.cantidad ? 'incompleto' :
                 producto.controlado > producto.cantidad ? 'excedente' : 'completo';
  
  return (
    <div 
      className={`
        p-3 rounded-md border 
        ${estado === 'incompleto' ? 'border-yellow-200 bg-yellow-50' : 
          estado === 'excedente' ? 'border-red-200 bg-red-50' : 
          'border-green-200 bg-green-50'}
        ${className}
      `}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{producto.codigo}</span>
            <Badge variant={
              estado === 'incompleto' ? 'outline' :
              estado === 'excedente' ? 'destructive' :
              'default'
            }>
              {estado === 'incompleto' ? 'INCOMPLETO' :
               estado === 'excedente' ? 'EXCEDENTE' :
               'COMPLETO'}
            </Badge>
          </div>
          <p className="text-sm text-gray-600 mt-1">{producto.descripcion}</p>
          {producto.ubicacion && (
            <p className="text-xs text-gray-500 mt-1">Ubicación: {producto.ubicacion}</p>
          )}
        </div>
        
        <div className="flex items-center">
          <div className={`
            text-lg font-bold 
            ${estado === 'incompleto' ? 'text-yellow-600' : 
              estado === 'excedente' ? 'text-red-600' : 
              'text-green-600'}
          `}>
            {producto.controlado}/{producto.cantidad}
          </div>
          <div className="ml-2">
            {estado === 'incompleto' && <Clock className="h-5 w-5 text-yellow-500" />}
            {estado === 'excedente' && <AlertTriangle className="h-5 w-5 text-red-500" />}
            {estado === 'completo' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          </div>
        </div>
      </div>
    </div>
  );
}
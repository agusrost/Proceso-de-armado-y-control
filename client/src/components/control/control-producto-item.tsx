import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { ProductoControlado } from '@shared/types';

interface ControlProductoItemProps {
  producto: ProductoControlado;
  className?: string;
  onClick?: () => void;
}

export function ControlProductoItem({ 
  producto, 
  className = "",
  onClick
}: ControlProductoItemProps) {
  // Determinar estado visual
  const isFaltante = producto.controlado < producto.cantidad;
  const isExcedente = producto.controlado > producto.cantidad;
  const isCompleto = producto.controlado === producto.cantidad;
  
  // Determinar colores basados en estado
  let statusColor = "bg-green-100 text-green-800 border-green-300";
  let statusIcon = <CheckCircle className="h-4 w-4 mr-2" />;
  
  if (isFaltante) {
    statusColor = "bg-yellow-100 text-yellow-800 border-yellow-300";
    statusIcon = <AlertTriangle className="h-4 w-4 mr-2" />;
  } else if (isExcedente) {
    statusColor = "bg-red-100 text-red-800 border-red-300";
    statusIcon = <AlertTriangle className="h-4 w-4 mr-2" />;
  }
  
  // Obtener mensaje de estado
  let statusMessage = "Completo";
  
  if (isFaltante) {
    statusMessage = "Faltante";
  } else if (isExcedente) {
    statusMessage = "Excedente";
  }
  
  return (
    <Card 
      className={`cursor-pointer border hover:border-primary hover:shadow transition-all ${className}`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <div className="font-medium flex items-center">
              <Package className="h-4 w-4 mr-2 text-gray-500" />
              {producto.codigo}
            </div>
            <div className="text-sm text-gray-600 truncate max-w-[200px]">
              {producto.descripcion}
            </div>
          </div>
          
          <div className="flex items-center min-w-[90px]">
            <div className="text-right mr-3">
              <div className="text-sm font-medium text-gray-500">
                Cantidad
              </div>
              <div className={`text-lg font-bold ${isCompleto ? 'text-green-600' : isFaltante ? 'text-yellow-600' : 'text-red-600'}`}>
                {producto.controlado}/{producto.cantidad}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-2">
          {producto.ubicacion && (
            <div className="text-xs text-gray-500">
              Ubicación: {producto.ubicacion}
            </div>
          )}
          
          <Badge 
            variant="outline" 
            className={`ml-auto flex items-center ${statusColor}`}
          >
            {statusIcon}
            {statusMessage}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductoControlado } from "@shared/types";
import { AlertTriangle, Check, Minus, Plus, Package, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ControlProductoItemProps {
  producto: ProductoControlado;
  onEscanear?: (cantidad?: number) => void;
}

export function ControlProductoItem({ producto, onEscanear }: ControlProductoItemProps) {
  // Colores según el estado
  const getStatusColor = () => {
    switch (producto.estado) {
      case 'correcto':
        return 'bg-green-50 border-green-200';
      case 'faltante':
        return 'bg-red-50 border-red-200';
      case 'excedente':
        return 'bg-amber-50 border-amber-200';
      default:
        return '';
    }
  };
  
  // Icono según el estado
  const getStatusIcon = () => {
    switch (producto.estado) {
      case 'correcto':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'faltante':
        return <Minus className="h-5 w-5 text-red-500" />;
      case 'excedente':
        return <Plus className="h-5 w-5 text-amber-500" />;
      default:
        return null;
    }
  };
  
  // Texto del estado
  const getStatusText = () => {
    switch (producto.estado) {
      case 'correcto':
        return 'Correcto';
      case 'faltante':
        return 'Faltante';
      case 'excedente':
        return 'Excedente';
      default:
        return 'Pendiente';
    }
  };
  
  // Colores para el badge de estado
  const getBadgeClass = () => {
    switch (producto.estado) {
      case 'correcto':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'faltante':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'excedente':
        return 'bg-amber-100 text-amber-800 hover:bg-amber-200';
      default:
        return 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200';
    }
  };

  return (
    <Card className={`overflow-hidden border ${getStatusColor()}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-1">
              <Package className="h-4 w-4 mr-2 text-neutral-500" />
              <span className="font-medium">{producto.codigo}</span>
              <Badge variant="outline" className={`ml-3 ${getBadgeClass()}`}>
                {getStatusText()}
              </Badge>
            </div>
            <p className="text-sm mb-1 line-clamp-2">{producto.descripcion}</p>
            {producto.ubicacion && (
              <div className="flex items-center text-xs text-neutral-500 mb-2">
                <MapPin className="h-3 w-3 mr-1" />
                <span>{producto.ubicacion}</span>
              </div>
            )}
            <div className="flex items-center mt-2 space-x-6">
              <div className="flex items-center">
                <span className="text-xs text-neutral-500 mr-2">Esperado:</span>
                <span className="font-medium">{producto.cantidad}</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-neutral-500 mr-2">Controlado:</span>
                <span className={`font-medium ${producto.controlado < producto.cantidad ? 'text-red-600' : producto.controlado > producto.cantidad ? 'text-amber-600' : 'text-green-600'}`}>
                  {producto.controlado}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-center justify-center ml-4">
            <div className="flex mb-2">
              {getStatusIcon()}
            </div>
            <div className="flex space-x-1">
              {onEscanear && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="px-2 h-8" 
                  onClick={() => onEscanear(1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              {onEscanear && producto.controlado > 0 && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="px-2 h-8 text-red-600 hover:text-red-700" 
                  onClick={() => onEscanear(-1)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
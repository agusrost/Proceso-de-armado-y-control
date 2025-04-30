import React, { useState } from "react";
import { ControlProductoItem } from "./control-producto-item";
import { RetirarExcedenteDialogNuevo } from "./retirar-excedente-dialog-nuevo";
import { ProductoControlado } from "@shared/types";
import { Loader2 } from "lucide-react";

interface ProductosEscaneadosListaProps {
  productos: ProductoControlado[];
  title?: string;
  description?: string;
  emptyMessage?: string;
  className?: string;
  pedidoId: number;
  isLoading?: boolean;
  onProductoUpdate?: (producto: ProductoControlado) => void;
}

export function ProductosEscaneadosLista({
  productos,
  title = "Productos escaneados",
  description,
  emptyMessage = "No hay productos escaneados",
  className = "",
  pedidoId,
  isLoading = false,
  onProductoUpdate
}: ProductosEscaneadosListaProps) {
  // Estado para el diálogo de excedentes
  const [excedentesDialog, setExcedentesDialog] = useState<{
    open: boolean;
    producto: ProductoControlado | null;
  }>({
    open: false,
    producto: null
  });

  // Manejar clic en un producto (para mostrar diálogo de excedentes)
  const handleProductoClick = (producto: ProductoControlado) => {
    // Solo abrir el diálogo si hay excedentes
    if (producto.controlado > producto.cantidad) {
      setExcedentesDialog({
        open: true,
        producto
      });
    }
  };

  // Cerrar el diálogo de excedentes
  const handleCloseExcedentes = () => {
    setExcedentesDialog({
      open: false,
      producto: null
    });
  };

  // Confirmar la retirada de excedentes
  const handleConfirmExcedentes = () => {
    // Cerrar diálogo
    setExcedentesDialog({
      open: false,
      producto: null
    });
    
    // Si hay un producto y una función de actualización, actualizar el producto
    if (excedentesDialog.producto && onProductoUpdate) {
      onProductoUpdate({
        ...excedentesDialog.producto,
        controlado: excedentesDialog.producto.cantidad,
        estado: 'correcto'
      });
    }
  };

  // Si está cargando, mostrar indicador
  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-gray-500">Cargando productos...</p>
      </div>
    );
  }

  // Si no hay productos, mostrar mensaje
  if (!productos || productos.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {title && <h3 className="text-lg font-medium mb-2">{title}</h3>}
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      
      <div className="grid grid-cols-1 gap-3">
        {productos.map((producto) => (
          <ControlProductoItem
            key={producto.codigo}
            producto={producto}
            onClick={() => handleProductoClick(producto)}
          />
        ))}
      </div>
      
      {/* Diálogo de retirada de excedentes */}
      {excedentesDialog.producto && (
        <RetirarExcedenteDialogNuevo
          open={excedentesDialog.open}
          onClose={handleCloseExcedentes}
          onConfirm={handleConfirmExcedentes}
          producto={excedentesDialog.producto}
          pedidoId={pedidoId}
        />
      )}
    </div>
  );
}
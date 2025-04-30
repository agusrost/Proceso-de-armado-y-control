import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ControlProductoItem } from './control-producto-item';
import { Loader2, PackageCheck, AlertTriangle } from 'lucide-react';
import { ProductoControlado } from '@shared/types';
import { RetirarExcedenteDialogNuevo } from './retirar-excedente-dialog-nuevo';

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
  title = "Productos Escaneados",
  description = "Lista de productos verificados en este pedido",
  emptyMessage = "Aún no se han escaneado productos para este pedido",
  className = "",
  pedidoId,
  isLoading = false,
  onProductoUpdate
}: ProductosEscaneadosListaProps) {
  const [excedenteDialogOpen, setExcedenteDialogOpen] = useState(false);
  const [productoExcedente, setProductoExcedente] = useState<ProductoControlado | null>(null);

  // Calcular estadísticas
  const totalProductos = productos.length;
  const productosCompletos = productos.filter(p => p.controlado >= p.cantidad).length;
  const productosExcedentes = productos.filter(p => p.controlado > p.cantidad).length;
  const productosFaltantes = productos.filter(p => p.controlado < p.cantidad).length;
  
  // Ordenar productos: primero los excedentes, luego los faltantes, y finalmente los completos
  const productosOrdenados = [...productos].sort((a, b) => {
    // Primero los excedentes (prioridad alta)
    if (a.controlado > a.cantidad && b.controlado <= b.cantidad) return -1;
    if (b.controlado > b.cantidad && a.controlado <= a.cantidad) return 1;
    
    // Luego los faltantes (prioridad media)
    if (a.controlado < a.cantidad && b.controlado >= b.cantidad) return -1;
    if (b.controlado < b.cantidad && a.controlado >= a.cantidad) return 1;
    
    // Por último ordenar por código
    return a.codigo.localeCompare(b.codigo);
  });

  // Manejar clic en producto
  const handleProductoClick = (producto: ProductoControlado) => {
    console.log("Producto seleccionado:", producto);
    
    // Si el producto tiene excedente, mostrar diálogo de retirada
    if (producto.controlado > producto.cantidad) {
      setProductoExcedente(producto);
      setExcedenteDialogOpen(true);
    }
  };

  // Manejar confirmación de retirada de excedente
  const handleExcedenteConfirmado = () => {
    setExcedenteDialogOpen(false);
    
    // Si hay callback de actualización, llamarlo con el producto actualizado
    if (productoExcedente && onProductoUpdate) {
      // La cantidad controlada ahora debe ser igual a la cantidad requerida
      onProductoUpdate({
        ...productoExcedente,
        controlado: productoExcedente.cantidad,
        estado: "correcto"
      });
    }
    
    setProductoExcedente(null);
  };

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PackageCheck className="h-5 w-5 mr-2 text-primary" />
            {title}
            {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          </CardTitle>
          <CardDescription>
            {description}
          </CardDescription>
          
          {totalProductos > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2 text-center text-sm">
              <div className={`rounded-md py-1 px-2 ${productosExcedentes > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100'}`}>
                <span className="font-bold">{productosExcedentes}</span> excedentes
              </div>
              <div className={`rounded-md py-1 px-2 ${productosFaltantes > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100'}`}>
                <span className="font-bold">{productosFaltantes}</span> faltantes
              </div>
              <div className={`rounded-md py-1 px-2 ${productosCompletos === totalProductos ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                <span className="font-bold">{productosCompletos}</span> completos
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : totalProductos === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <PackageCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>{emptyMessage}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {productosOrdenados.map((producto) => (
                <ControlProductoItem 
                  key={producto.codigo}
                  producto={producto}
                  onClick={() => handleProductoClick(producto)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Diálogo para retirar excedente */}
      {productoExcedente && (
        <RetirarExcedenteDialogNuevo
          open={excedenteDialogOpen}
          onClose={() => setExcedenteDialogOpen(false)}
          onConfirm={handleExcedenteConfirmado}
          producto={productoExcedente}
          pedidoId={pedidoId}
        />
      )}
    </>
  );
}
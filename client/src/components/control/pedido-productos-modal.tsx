import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Definición de la interfaz Producto
interface Producto {
  id: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  ubicacion?: string;
  productoId?: number;
  pedidoId?: number;
}

interface PedidoProductosModalProps {
  pedidoId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function PedidoProductosModal({ pedidoId, isOpen, onClose }: PedidoProductosModalProps) {
  // Cargar solo los productos del pedido
  const { data: productos = [], isLoading } = useQuery<Producto[]>({
    queryKey: ["/api/pedidos", pedidoId, "productos"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pedidos/${pedidoId}/productos`);
      return res.json();
    },
    enabled: isOpen && !!pedidoId,
  });

  // Cargar información básica del pedido para el título
  const { data: pedido } = useQuery({
    queryKey: ["/api/pedidos", pedidoId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pedidos/${pedidoId}`);
      return res.json();
    },
    enabled: isOpen && !!pedidoId,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle de Productos - Pedido {pedido?.pedidoId}</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tabla de productos */}
            <div className="overflow-x-auto border rounded-md">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-100">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Código</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Cantidad</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Descripción</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ubicación</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {productos.length > 0 ? (
                    productos.map((producto) => (
                      <tr key={producto.id} className="hover:bg-neutral-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-neutral-900">{producto.codigo}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-500">{producto.cantidad}</td>
                        <td className="px-4 py-2 text-sm text-neutral-500">{producto.descripcion}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-500">{producto.ubicacion || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-sm text-neutral-500">
                        No hay productos para este pedido
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
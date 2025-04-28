import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Circle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

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
  // Cargar los productos del pedido usando el endpoint alternativo de pre-control
  // que está diseñado específicamente para resolver problemas de datos
  const { data: preControlData, isLoading: isLoadingPreControl } = useQuery({
    queryKey: ["/api/control/pedidos", pedidoId, "pre-control"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/control/pedidos/${pedidoId}/pre-control`);
      return res.json();
    },
    enabled: isOpen && !!pedidoId,
  });
  
  // Obtener el estado actual del control para saber qué productos ya han sido escaneados
  const { data: controlData, isLoading: isLoadingControl } = useQuery({
    queryKey: ["/api/control/pedidos", pedidoId, "activo"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/control/pedidos/${pedidoId}/activo`);
      return res.json();
    },
    enabled: isOpen && !!pedidoId,
  });
  
  // Determinar si un producto ha sido escaneado
  const productosEscaneados = controlData?.detalles || [];
  
  // Crear un mapa de códigos escaneados para fácil búsqueda con cantidad controlada
  const codigosEscaneados = new Map();
  productosEscaneados.forEach((detalle: any) => {
    codigosEscaneados.set(detalle.codigo, {
      escaneado: true,
      cantidadControlada: detalle.cantidadControlada || 0
    });
  });
  
  // Extraer productos del resultado
  const productos = preControlData?.productos || [];
  
  // Estado de carga combinado
  const isLoading = isLoadingPreControl || isLoadingControl;
  
  // Agregar logs para depuración
  console.log("Datos de pre-control:", preControlData);
  console.log("Productos encontrados:", productos?.length || 0);
  console.log("Productos escaneados:", productosEscaneados?.length || 0, codigosEscaneados);
  
  // Buscar y mostrar información específica del producto 17061 para depuración
  const producto17061 = productos.find(p => p.codigo === '17061');
  if (producto17061) {
    console.log("DETALLE PRODUCTO 17061 (modal):", {
      id: producto17061.id,
      codigo: producto17061.codigo,
      cantidad: producto17061.cantidad, // Debería ser 2
      ubicacion: producto17061.ubicacion,
      descripcion: producto17061.descripcion
    });
    
    const controlInfo = codigosEscaneados.get('17061');
    console.log("INFO CONTROL 17061:", controlInfo || "No hay información de control");
  }

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
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Estado</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Código</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <span>Cantidad</span>
                        <span className="text-[10px] normal-case font-normal text-neutral-400">(Registrada / Solicitada)</span>
                      </div>
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Descripción</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ubicación</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {productos.length > 0 ? (
                    productos.map((producto) => {
                      const infoProducto = codigosEscaneados.get(producto.codigo);
                      const estaEscaneado = !!infoProducto;
                      const cantidadControlada = infoProducto?.cantidadControlada || 0;
                      
                      // Determinar el color del texto de cantidad según si hay faltantes o excedentes
                      let cantidadClassName = "text-neutral-500";
                      if (estaEscaneado) {
                        if (cantidadControlada < producto.cantidad) {
                          cantidadClassName = "text-amber-600 font-medium"; // Faltante
                        } else if (cantidadControlada > producto.cantidad) {
                          cantidadClassName = "text-blue-600 font-medium"; // Excedente
                        } else {
                          cantidadClassName = "text-emerald-600 font-medium"; // Correcto
                        }
                      }
                      
                      return (
                        <tr 
                          key={producto.id} 
                          className={cn(
                            "hover:bg-neutral-50",
                            estaEscaneado ? "bg-emerald-50" : ""
                          )}
                        >
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-500">
                            {estaEscaneado ? (
                              <CheckCircle className="h-5 w-5 text-emerald-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-neutral-300" />
                            )}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-neutral-900">{producto.codigo}</td>
                          <td className={`px-4 py-2 whitespace-nowrap text-sm ${cantidadClassName}`}>
                            {estaEscaneado 
                              ? `${cantidadControlada} / ${producto.cantidad}`
                              : producto.cantidad
                            }
                          </td>
                          <td className="px-4 py-2 text-sm text-neutral-500">{producto.descripcion}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-500">{producto.ubicacion || "-"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-sm text-neutral-500">
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
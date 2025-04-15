import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PedidoWithDetails } from "@shared/types";
import { getEstadoColor, getEstadoLabel, formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Edit, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface PedidoDetailModalProps {
  pedidoId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function PedidoDetailModal({ pedidoId, isOpen, onClose }: PedidoDetailModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin-plus' || user?.role === 'admin-gral';
  const [editingArmador, setEditingArmador] = useState(false);
  const [selectedArmadorId, setSelectedArmadorId] = useState<string>("");
  
  // Fetch pedido details
  const { data: pedido, isLoading } = useQuery<PedidoWithDetails>({
    queryKey: [`/api/pedidos/${pedidoId}`],
    enabled: isOpen && !!pedidoId,
  });
  
  // Fetch armadores for the dropdown
  const { data: armadores = [] } = useQuery({
    queryKey: ["/api/users/armadores"],
    enabled: isOpen && isAdmin,
  });
  
  // Update pedido mutation
  const updatePedidoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/pedidos/${pedidoId}`, {
        armadorId: selectedArmadorId === "aleatorio" ? null : parseInt(selectedArmadorId),
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Pedido actualizado",
        description: "El armador ha sido actualizado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/pedidos/${pedidoId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos"] });
      setEditingArmador(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Set the selected armador when pedido is loaded
  useEffect(() => {
    if (pedido) {
      setSelectedArmadorId(pedido.armadorId ? String(pedido.armadorId) : "aleatorio");
    }
  }, [pedido]);
  
  const canEditArmador = isAdmin && pedido && pedido.estado === "pendiente";
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalle del Pedido</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !pedido ? (
          <div className="text-center py-8">
            No se pudo cargar la información del pedido
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-500">ID Pedido</p>
                <p className="font-semibold">{pedido.pedidoId}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Fecha</p>
                <p className="font-semibold">{formatDate(pedido.fecha)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Cliente</p>
                <p className="font-semibold">{pedido.clienteId}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Vendedor</p>
                <p className="font-semibold">{pedido.vendedor || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Estado</p>
                <p>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getEstadoColor(pedido.estado)}`}>
                    {getEstadoLabel(pedido.estado)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Armador</p>
                {canEditArmador && editingArmador ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedArmadorId}
                      onValueChange={setSelectedArmadorId}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Aleatorio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aleatorio">Aleatorio</SelectItem>
                        {armadores.map((armador) => (
                          <SelectItem key={armador.id} value={armador.id.toString()}>
                            {armador.firstName || armador.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => updatePedidoMutation.mutate()}
                      disabled={updatePedidoMutation.isPending}
                    >
                      {updatePedidoMutation.isPending ? 
                        <Loader2 className="h-4 w-4 animate-spin" /> : 
                        <Check className="h-4 w-4" />
                      }
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">
                      {pedido.armadorId ? (pedido.armador?.firstName || pedido.armador?.username) : "Aleatorio"}
                    </p>
                    {canEditArmador && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setEditingArmador(true)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Puntaje</p>
                <p className="font-semibold">{pedido.puntaje}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Tiempo Neto</p>
                <p className="font-semibold">{pedido.tiempoNeto || '-'}</p>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="font-medium mb-2">Productos</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-100">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Código</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Cantidad</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Descripción</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Recolectado</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {pedido.productos && pedido.productos.length > 0 ? (
                      pedido.productos.map((producto, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-neutral-800">
                            {producto.codigo}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                            {producto.cantidad}
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-800">
                            {producto.descripcion}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              producto.recolectado >= producto.cantidad ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
                            }`}>
                              {producto.recolectado}/{producto.cantidad}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-center">No hay productos registrados</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {pedido.pausas && pedido.pausas.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Pausas</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-100">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Hora Inicio</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Hora Fin</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Duración</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-200">
                      {pedido.pausas.map((pausa, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                            {new Date(pausa.inicio).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                            {pausa.fin ? new Date(pausa.fin).toLocaleTimeString() : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                            {pausa.duracion || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-800">
                            {pausa.motivo}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
        
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

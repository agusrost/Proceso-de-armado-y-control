import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PedidoWithDetails } from "@shared/types";
import { getEstadoColor, getEstadoLabel, formatDate, formatTimeHM } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Edit, Check, CheckCircle2, Trash2, Truck as TruckIcon, AlertCircle } from "lucide-react";
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
  // Verificar roles para permisos de edición
  const isAdmin = user?.role === 'admin-plus' || user?.role === 'admin-gral';
  const isArmador = user?.role === 'armador';
  
  // Estados para edición
  const [editingArmador, setEditingArmador] = useState(false);
  const [selectedArmadorId, setSelectedArmadorId] = useState<string>("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editRecolectado, setEditRecolectado] = useState<number>(0);
  const [editMotivo, setEditMotivo] = useState<string>("");
  
  // Fetch pedido details
  const { data: pedido, isLoading, error } = useQuery<PedidoWithDetails>({
    queryKey: [`/api/pedidos/${pedidoId}`],
    enabled: isOpen && !!pedidoId,
    onSuccess: (data) => {
      console.log('Datos del pedido recibidos:', data);
    },
    onError: (err) => {
      console.error('Error al cargar pedido:', err);
    }
  });
  
  // Fetch armadores (for admin)
  const { data: armadores } = useQuery({
    queryKey: ["/api/users/armadores"],
    enabled: isAdmin && isOpen
  });
  
  // Update pedido (for armador assignment)
  const updatePedidoMutation = useMutation({
    mutationFn: async () => {
      const armadorId = selectedArmadorId === "aleatorio" ? null : parseInt(selectedArmadorId);
      const res = await apiRequest("PATCH", `/api/pedidos/${pedidoId}`, {
        armadorId
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Pedido actualizado",
        description: "El armador ha sido asignado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/pedidos/${pedidoId}`] });
      setEditingArmador(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Delete pedido mutation (admin only)
  const deletePedidoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/pedidos/${pedidoId}`, {});
      return res;
    },
    onSuccess: () => {
      toast({
        title: "Pedido eliminado",
        description: "El pedido ha sido eliminado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos"] });
      setDeleteConfirmOpen(false);
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
      setDeleteConfirmOpen(false);
    }
  });
  
  // *** SOLUCIÓN CRÍTICA: Editar cantidades de productos ***
  const updateProductoMutation = useMutation({
    mutationFn: async () => {
      if (!editingProductId) return null;
      
      console.log("ACTUALIZANDO PRODUCTO...");
      console.log("ID producto:", editingProductId);
      console.log("Recolectado:", editRecolectado);
      console.log("Motivo:", editMotivo);
      
      // Si el motivo está vacío y hay faltantes, añadir un motivo por defecto
      let motivoFinal = editMotivo;
      if (editRecolectado < (pedido?.productos?.find(p => p.id === editingProductId)?.cantidad || 0) && !editMotivo) {
        motivoFinal = "falta-stock";
      }
      
      // Solicitud a la API
      try {
        const res = await apiRequest("PATCH", `/api/productos/${editingProductId}`, {
          recolectado: editRecolectado,
          motivo: motivoFinal
        });
        
        console.log("Respuesta API:", res.status);
        return await res.json();
      } catch (error) {
        console.error("Error en solicitud:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Producto actualizado",
        description: "La cantidad del producto ha sido actualizada correctamente",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/pedidos/${pedidoId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      setEditingProductId(null);
      setEditRecolectado(0);
      setEditMotivo("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar producto",
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
  const canDelete = isAdmin; // Permitir eliminar pedidos en cualquier estado para administradores
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex justify-between items-start">
          <DialogTitle>Detalle del Pedido</DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 p-0">
            <span className="sr-only">Cerrar</span>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
              <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
            </svg>
          </Button>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p>Error al cargar la información del pedido:</p>
            <p className="text-red-500">{(error as Error).message}</p>
          </div>
        ) : !pedido ? (
          <div className="text-center py-8">
            No se pudo cargar la información del pedido
          </div>
        ) : (
          <>
            {/* Información General - Encabezado */}
            <div className="mb-6 overflow-x-auto">
              <table className="min-w-full border border-neutral-200 rounded-md">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-b">Nro Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-b">Nro ID Pedido</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-b">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-b">Vendedor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-b">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-b">Puntaje</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  <tr>
                    <td className="px-4 py-3 whitespace-nowrap text-sm border-b">{pedido.clienteId}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold border-b">{pedido.pedidoId}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm border-b">{formatDate(pedido.fecha)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm border-b">{pedido.vendedor || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm border-b">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getEstadoColor(pedido.estado)}`}>
                        {getEstadoLabel(pedido.estado)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm border-b">{pedido.puntaje}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            {/* Datos de Armado y Control */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sección de Armado */}
              <div className="border rounded-md overflow-hidden">
                <div className="bg-blue-50 px-4 py-2 border-b">
                  <h3 className="font-semibold text-blue-800">Datos de Armado</h3>
                </div>
                <div className="p-4">
                  <table className="min-w-full">
                    <tbody>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Armado por</td>
                        <td className="py-2 text-sm font-semibold">
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
                                  {Array.isArray(armadores) && armadores.map((armador) => (
                                    <SelectItem key={armador.id} value={String(armador.id)}>
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
                              <span>
                                {pedido.armadorId ? (pedido.armador?.firstName || pedido.armador?.username) : "Aleatorio"}
                              </span>
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
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Fecha de armado</td>
                        <td className="py-2 text-sm font-semibold">
                          {pedido.inicio ? formatDate(pedido.inicio) : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Horario inicio</td>
                        <td className="py-2 text-sm font-semibold">
                          {pedido.inicio ? new Date(pedido.inicio).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Horario fin</td>
                        <td className="py-2 text-sm font-semibold">
                          {pedido.finalizado ? new Date(pedido.finalizado).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Pausas armado</td>
                        <td className="py-2">
                          <button 
                            className="text-sm font-semibold text-blue-600 hover:underline"
                            onClick={() => {
                              // Aquí se podría implementar mostrar un dialogo con las pausas de armado
                              toast({
                                title: "Detalles de pausas",
                                description: "Ver detalles de pausas de armado",
                              });
                            }}
                          >
                            {pedido.numeroPausas || 0} {pedido.numeroPausas === 1 ? 'pausa' : 'pausas'}
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Tiempo bruto</td>
                        <td className="py-2 text-sm font-semibold">
                          {pedido.tiempoBruto ? formatTimeHM(pedido.tiempoBruto) : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Tiempo neto</td>
                        <td className="py-2 text-sm font-semibold">
                          {pedido.tiempoNeto ? formatTimeHM(pedido.tiempoNeto) : '-'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Sección de Control */}
              <div className="border rounded-md overflow-hidden">
                <div className="bg-green-50 px-4 py-2 border-b">
                  <h3 className="font-semibold text-green-800">Datos de Control</h3>
                </div>
                <div className="p-4">
                  <table className="min-w-full">
                    <tbody>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Controlado por</td>
                        <td className="py-2 text-sm font-semibold">
                          {pedido.controladoPor ? (pedido.controlador?.firstName || pedido.controlador?.username) : "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Fecha de control</td>
                        <td className="py-2 text-sm font-semibold">
                          {pedido.controlInicio ? formatDate(pedido.controlInicio) : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Horario inicio</td>
                        <td className="py-2 text-sm font-semibold">
                          {pedido.controlInicio ? new Date(pedido.controlInicio).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Horario fin</td>
                        <td className="py-2 text-sm font-semibold">
                          {pedido.controlFin ? new Date(pedido.controlFin).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Pausas control</td>
                        <td className="py-2">
                          <button 
                            className="text-sm font-semibold text-green-600 hover:underline"
                            onClick={() => {
                              // Aquí se podría implementar mostrar un dialogo con las pausas de control
                              toast({
                                title: "Detalles de pausas",
                                description: "Ver detalles de pausas de control",
                              });
                            }}
                          >
                            {pedido.controlPausas || 0} {pedido.controlPausas === 1 ? 'pausa' : 'pausas'}
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Tiempo bruto</td>
                        <td className="py-2 text-sm font-semibold">
                          {pedido.controlTiempoBruto ? formatTimeHM(pedido.controlTiempoBruto) : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-sm font-medium text-neutral-500">Tiempo neto</td>
                        <td className="py-2 text-sm font-semibold">
                          {pedido.controlTiempoNeto ? formatTimeHM(pedido.controlTiempoNeto) : '-'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="font-medium mb-2">Productos</h4>
              <div className="overflow-x-auto border rounded-md">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-100">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Código</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Cantidad</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Descripción</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Recolectado</th>
                      {/* Siempre mostrar columna de acciones para admin/armador */}
                      {(isAdmin || isArmador) && (
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Acciones</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {pedido.productos && pedido.productos.length > 0 ? (
                      pedido.productos.map((producto, index) => (
                        <tr key={index} className={editingProductId === producto.id ? 'bg-blue-50' : ''}>
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
                            {editingProductId === producto.id ? (
                              // MODO EDICIÓN
                              <div className="flex flex-col space-y-2 w-full">
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="number"
                                    className="w-20 px-2 py-1 border rounded"
                                    value={editRecolectado}
                                    onChange={(e) => setEditRecolectado(parseInt(e.target.value) || 0)}
                                    min={0}
                                    max={producto.cantidad}
                                  />
                                  <span className="text-sm text-neutral-500">/ {producto.cantidad}</span>
                                </div>
                                {editRecolectado < producto.cantidad && (
                                  <input
                                    type="text"
                                    className="w-full px-2 py-1 border rounded text-sm"
                                    value={editMotivo}
                                    onChange={(e) => setEditMotivo(e.target.value)}
                                    placeholder="Motivo del faltante"
                                  />
                                )}
                              </div>
                            ) : (
                              // MODO VISUALIZACIÓN
                              producto.recolectado !== null ? (
                                <div>
                                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    producto.recolectado >= producto.cantidad ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
                                  }`}>
                                    {producto.recolectado}/{producto.cantidad}
                                  </span>
                                  
                                  {/* Mostrar unidades transferidas si hay */}
                                  {(() => {
                                    // Verificar si el producto tiene unidades transferidas mediante stock
                                    const unidadesTransferidas = producto.unidadesTransferidas > 0 
                                      ? producto.unidadesTransferidas // Si el campo tiene un valor positivo, usarlo
                                      : producto.motivo?.includes('[Stock: Transferencia completada')
                                        ? parseInt(producto.motivo.match(/Transferencia completada - (\d+) unidades/)?.[1] || '0')
                                        : 0;
                                    
                                    // Mostrar la notificación de transferencia si hay unidades
                                    return unidadesTransferidas > 0 ? (
                                      <div className="mt-1 flex items-center gap-1 bg-blue-50 border border-blue-200 rounded p-1 text-xs">
                                        <TruckIcon className="h-3 w-3 text-blue-600" />
                                        <span className="font-medium text-blue-600">
                                          {unidadesTransferidas} {unidadesTransferidas === 1 ? 'unidad transferida' : 'unidades transferidas'} por Stock
                                        </span>
                                      </div>
                                    ) : null;
                                  })()}
                                  
                                  {producto.motivo && (
                                    <div className={`mt-1 text-xs ${producto.motivo.includes('[Stock: Transferencia completada') ? 'text-green-600' : 'text-red-600'}`}>
                                      {producto.motivo.includes('[Stock: Transferencia completada') ? (
                                        <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded p-1">
                                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                                          <span className="font-medium">
                                            Completado con transferencia de stock
                                          </span>
                                        </div>
                                      ) : producto.motivo.includes('[Stock: No disponible') ? (
                                        <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded p-1">
                                          <AlertCircle className="h-3 w-3 text-red-600" />
                                          <span className="font-medium">
                                            Stock no disponible para transferencia
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <span className="font-medium">Faltante:</span> {producto.motivo}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">No recolectado</span>
                              )
                            )}
                          </td>
                          {/* Columna de acciones - visible para admin/armador sin importar el estado */}
                          {(isAdmin || isArmador) && (
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {editingProductId === producto.id ? (
                                // BOTONES DE EDICIÓN
                                <div className="flex space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateProductoMutation.mutate()}
                                    disabled={updateProductoMutation.isPending}
                                    className="border-green-500 hover:bg-green-50 hover:text-green-700"
                                  >
                                    {updateProductoMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                    <span className="ml-1">Guardar</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingProductId(null);
                                      setEditRecolectado(0);
                                      setEditMotivo("");
                                    }}
                                    className="border-gray-300"
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                // BOTÓN PARA INICIAR EDICIÓN (siempre visible)
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    console.log("Editando producto:", producto.id);
                                    setEditingProductId(producto.id);
                                    setEditRecolectado(producto.recolectado !== null ? producto.recolectado : 0);
                                    setEditMotivo(producto.motivo || "");
                                  }}
                                  className="border-blue-500 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={(isAdmin || isArmador) ? 5 : 4} className="px-4 py-3 text-center">No hay productos registrados</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {pedido.pausas && pedido.pausas.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Pausas</h4>
                <div className="overflow-x-auto border rounded-md">
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
                            {pausa.duracion || 
                              (pausa.fin && pausa.inicio ? 
                                (() => {
                                  const inicio = new Date(pausa.inicio);
                                  const fin = new Date(pausa.fin);
                                  const duracionMs = fin.getTime() - inicio.getTime();
                                  const minutos = Math.floor(duracionMs / 60000);
                                  const segundos = Math.floor((duracionMs % 60000) / 1000);
                                  return `${minutos}m ${segundos}s`;
                                })() : 
                                '-'
                              )
                            }
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
        
        <DialogFooter className="flex items-center justify-between gap-4">
          {canDelete && (
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deletePedidoMutation.isPending}>
                  {deletePedidoMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Eliminar Pedido
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar Pedido</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Estás seguro que deseas eliminar este pedido? Esta acción no se puede deshacer 
                    y eliminará todos los productos y pausas asociados a este pedido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deletePedidoMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
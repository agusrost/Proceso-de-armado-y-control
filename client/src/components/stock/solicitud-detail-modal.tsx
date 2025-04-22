import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { StockSolicitudWithDetails } from "@shared/types";
import { PedidoWithDetails } from "@shared/types";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface SolicitudDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  solicitudId: number;
}

export default function SolicitudDetailModal({ isOpen, onClose, solicitudId }: SolicitudDetailModalProps) {
  const { toast } = useToast();
  const [pedidoId, setPedidoId] = useState<number | null>(null);

  // Obtener detalles de la solicitud
  const { data: solicitud, isLoading, error } = useQuery<StockSolicitudWithDetails>({
    queryKey: ["/api/stock/detalle", solicitudId],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${solicitudId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al obtener detalles de la solicitud");
      }
      return await res.json();
    },
    enabled: isOpen && solicitudId > 0,
  });

  // Buscar el pedido asociado si el motivo contiene un ID de pedido
  const { data: pedido, isLoading: isLoadingPedido } = useQuery<PedidoWithDetails>({
    queryKey: ["/api/pedidos", pedidoId],
    queryFn: async () => {
      const res = await fetch(`/api/pedidos/${pedidoId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al obtener detalles del pedido");
      }
      return await res.json();
    },
    enabled: isOpen && pedidoId !== null,
  });

  // Procesar el motivo para extraer ID de pedido si existe
  React.useEffect(() => {
    if (solicitud?.motivo) {
      // Buscar "Pedido ID X" o "Pedido X" en el motivo
      const pedidoMatch = solicitud.motivo.match(/Pedido(?:\s+ID)?\s+([A-Za-z0-9]+)/i);
      if (pedidoMatch && pedidoMatch[1]) {
        // Buscar el pedido con ese pedidoId
        fetch(`/api/pedidos/by-pedidoid/${pedidoMatch[1]}`)
          .then(res => {
            if (res.ok) return res.json();
            return null;
          })
          .then(data => {
            if (data && data.id) {
              setPedidoId(data.id);
            }
          })
          .catch(err => {
            console.error("Error buscando pedido:", err);
          });
      }
    }
  }, [solicitud]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalles de la Solicitud de Stock</DialogTitle>
          <DialogDescription>
            Información completa sobre la solicitud de transferencia
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-red-500">Error al cargar los datos: {error.toString()}</div>
        ) : solicitud ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-neutral-500">Código</h4>
                <p className="font-mono">{solicitud.codigo}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-neutral-500">Cantidad</h4>
                <p>{solicitud.cantidad}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-neutral-500">Fecha</h4>
                <p>{formatDate(solicitud.fecha)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-neutral-500">Horario</h4>
                <p>{new Date(solicitud.horario).toLocaleTimeString()}</p>
              </div>
              <div className="col-span-2">
                <h4 className="text-sm font-medium text-neutral-500">Motivo</h4>
                <p>{solicitud.motivo}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-neutral-500">Estado</h4>
                <p className={`inline-flex px-2 text-xs leading-5 font-semibold rounded-full ${
                  solicitud.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                  solicitud.estado === 'realizado' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {solicitud.estado === 'pendiente' ? 'Pendiente' :
                   solicitud.estado === 'realizado' ? 'Realizado' : 'No hay'}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-neutral-500">Solicitado por</h4>
                <p>{solicitud.solicitante?.username || "-"}</p>
              </div>
              {solicitud.realizadoPor && (
                <div className="col-span-2">
                  <h4 className="text-sm font-medium text-neutral-500">Realizado por</h4>
                  <p>{solicitud.realizador?.username || "-"}</p>
                </div>
              )}
            </div>

            {pedidoId && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Información del Pedido</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingPedido ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : pedido ? (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium">Cliente ID:</span> {pedido.clienteId}
                      </div>
                      <div>
                        <span className="font-medium">Pedido ID:</span> {pedido.pedidoId}
                      </div>
                      <div>
                        <span className="font-medium">Vendedor:</span> {pedido.vendedor}
                      </div>
                      <div>
                        <span className="font-medium">Estado:</span> {
                          pedido.estado === 'pendiente' ? 'Pendiente' :
                          pedido.estado === 'en-proceso' ? 'En proceso' :
                          pedido.estado === 'pre-finalizado' ? 'Pre-finalizado' : 'Completado'
                        }
                      </div>
                      <div className="col-span-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2 w-full"
                          onClick={() => {
                            onClose();
                            window.location.href = `/pedidos/detalle/${pedido.id}`;
                          }}
                        >
                          Ver Pedido Completo
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">No se encontró información del pedido relacionado.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
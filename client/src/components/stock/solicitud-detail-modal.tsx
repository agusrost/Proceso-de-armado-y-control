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

  // Obtener detalles de la solicitud
  const { data: solicitud, isLoading, error } = useQuery<StockSolicitudWithDetails & { 
    pedidoRelacionado?: PedidoWithDetails,
    armador?: { username: string, id: number }
  }>({
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

            {solicitud?.pedidoRelacionado && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Información del Pedido</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Cliente ID:</span> {solicitud.pedidoRelacionado.clienteId}
                    </div>
                    <div>
                      <span className="font-medium">Pedido ID:</span> {solicitud.pedidoRelacionado.pedidoId}
                    </div>
                    <div>
                      <span className="font-medium">Vendedor:</span> {solicitud.pedidoRelacionado.vendedor}
                    </div>
                    <div>
                      <span className="font-medium">Estado:</span> {
                        solicitud.pedidoRelacionado.estado === 'pendiente' ? 'Pendiente' :
                        solicitud.pedidoRelacionado.estado === 'en-proceso' ? 'En proceso' :
                        solicitud.pedidoRelacionado.estado === 'pre-finalizado' ? 'Pre-finalizado' : 'Completado'
                      }
                    </div>
                    
                    {solicitud.armador && (
                      <div className="col-span-2">
                        <span className="font-medium">Armador asignado:</span> {solicitud.armador.username}
                      </div>
                    )}
                    
                    <div className="col-span-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2 w-full"
                        onClick={() => {
                          onClose();
                          if (solicitud.pedidoRelacionado?.id) {
                            window.location.href = `/pedidos/detalle/${solicitud.pedidoRelacionado.id}`;
                          }
                        }}
                      >
                        Ver Pedido Completo
                      </Button>
                    </div>
                  </div>
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
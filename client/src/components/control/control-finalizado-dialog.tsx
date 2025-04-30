import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatTimeDuration } from "@/lib/utils";

interface ControlFinalizadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensaje?: string;
  pedidoId?: number | null;
  tiempoTranscurrido?: number;
}

export function ControlFinalizadoDialog({
  open,
  onOpenChange,
  mensaje = "Control finalizado correctamente",
  pedidoId,
  tiempoTranscurrido = 0
}: ControlFinalizadoDialogProps) {
  const [_, setLocation] = useLocation();

  // Cargar información actualizada del pedido para mostrar el estado actualizado
  const { data: pedido } = useQuery({
    queryKey: ["/api/pedidos", pedidoId],
    queryFn: async () => {
      if (!pedidoId) return null;
      const res = await fetch(`/api/pedidos/${pedidoId}`);
      if (!res.ok) return null;
      return await res.json();
    },
    enabled: open && !!pedidoId,
    refetchOnMount: true, // Siempre refrescar al montar para tener datos actualizados
  });

  // Reproducir sonido de éxito cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      try {
        const audio = new Audio('/sounds/success.mp3');
        audio.play();
      } catch (e) {
        console.log('Error reproduciendo sonido:', e);
      }
    }
  }, [open]);

  const handleOk = () => {
    onOpenChange(false);
    setLocation("/control");
  };

  // Formatear el tiempo transcurrido
  const tiempoFormateado = formatTimeDuration(tiempoTranscurrido);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            Control Finalizado
          </DialogTitle>
          <DialogDescription>
            {mensaje}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center py-4">
          <div className="text-center">
            <p className="text-lg font-medium text-gray-700">
              El control ha sido completado con éxito.
            </p>
            
            {pedido && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md border">
                <p className="text-sm font-medium">
                  Pedido: <span className="text-gray-800">{pedido.pedidoId}</span>
                </p>
                <p className="text-sm font-medium mt-1">
                  Estado: <span className="font-bold text-green-600">CONTROLADO</span>
                </p>
              </div>
            )}
            
            {tiempoTranscurrido > 0 && (
              <div className="mt-3 flex items-center justify-center gap-1 text-gray-600">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Tiempo de control: {tiempoFormateado}</span>
              </div>
            )}
            
            <p className="text-sm text-gray-500 mt-3">
              Todos los productos han sido verificados correctamente.
            </p>
          </div>
        </div>
        <DialogFooter className="flex justify-center sm:justify-center">
          <Button onClick={handleOk} className="px-8">
            Volver a Control
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PausaControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedidoId: number | null;
  onPausaCreada: (pausaId: number) => void;
}

export default function PausaControlModal({ isOpen, onClose, pedidoId, onPausaCreada }: PausaControlModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Opciones de motivos de pausa
  const motivosPausa = [
    "Motivos sanitarios",
    "Almuerzo",
    "Fin de turno",
    "Otro: especificar"
  ];
  
  const [motivoPausa, setMotivoPausa] = useState("");
  const [motivoPausaDetalle, setMotivoPausaDetalle] = useState("");
  
  // Mutation para crear pausa de control
  const crearPausaMutation = useMutation({
    mutationFn: async () => {
      if (!pedidoId) throw new Error("ID de pedido no válido");
      
      // Si el motivo es "Otro: especificar", usamos el detalle ingresado
      const motivoFinal = motivoPausa === "Otro: especificar" 
        ? motivoPausaDetalle 
        : motivoPausa;
        
      if (!motivoFinal) {
        throw new Error("Debe especificar un motivo para la pausa");
      }
      
      const pausaData = {
        pedidoId,
        motivo: motivoFinal,
        tipo: "control" // Indicar que es una pausa de control
      };
      
      const res = await apiRequest("POST", "/api/pausas", pausaData);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Pausa de control iniciada",
        description: "El control se ha pausado correctamente",
      });
      
      // Invalidar consultas para actualizar datos
      queryClient.invalidateQueries({ queryKey: [`/api/pedidos/${pedidoId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/control/pedidos/${pedidoId}/activo`] });
      
      // Resetear formulario
      setMotivoPausa("");
      setMotivoPausaDetalle("");
      
      // Cerrar modal
      onClose();
      
      // Notificar que se creó la pausa
      onPausaCreada(data.id);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al pausar el control",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Manejar el envío del formulario
  const handlePausar = () => {
    if (!motivoPausa) {
      toast({
        title: "Motivo requerido",
        description: "Debes seleccionar un motivo para la pausa",
        variant: "destructive",
      });
      return;
    }
    
    // Si es "Otro: especificar" pero no hay detalle
    if (motivoPausa === "Otro: especificar" && !motivoPausaDetalle) {
      toast({
        title: "Detalle requerido",
        description: "Debes especificar el motivo de la pausa",
        variant: "destructive",
      });
      return;
    }
    
    crearPausaMutation.mutate();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 text-white border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-xl">Pausar control</DialogTitle>
          <DialogDescription className="text-gray-300">
            Selecciona el motivo por el cual estás pausando el control del pedido.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white">Motivo:</label>
            <select
              className="w-full p-3 border border-blue-800 rounded-md bg-blue-900 text-white"
              value={motivoPausa}
              onChange={(e) => setMotivoPausa(e.target.value)}
            >
              <option value="">Seleccione un motivo</option>
              {motivosPausa.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          
          {motivoPausa === "Otro: especificar" && (
            <div>
              <label className="block text-sm font-medium mb-2 text-white">Detalle del motivo:</label>
              <input
                type="text"
                value={motivoPausaDetalle}
                onChange={(e) => setMotivoPausaDetalle(e.target.value)}
                className="w-full p-3 bg-blue-900 border border-blue-800 text-white placeholder:text-blue-300 rounded-md"
                placeholder="Especifique el motivo"
              />
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2 mt-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="border-red-400 bg-red-900/40 text-white hover:bg-red-800 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={handlePausar}
            disabled={crearPausaMutation.isPending}
            className="bg-white text-blue-950 hover:bg-gray-100"
          >
            {crearPausaMutation.isPending ? 'Procesando...' : 'Pausar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
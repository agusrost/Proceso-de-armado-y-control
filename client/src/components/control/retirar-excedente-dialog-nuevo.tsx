import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProductoControlado } from "@shared/types";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface RetirarExcedenteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  producto: ProductoControlado;
  pedidoId: number;
}

export function RetirarExcedenteDialogNuevo({
  open,
  onClose,
  onConfirm,
  producto,
  pedidoId
}: RetirarExcedenteDialogProps) {
  const { toast } = useToast();
  const [procesando, setProcesando] = useState(false);
  const [exitoso, setExitoso] = useState(false);

  // Mutación para retirar excedentes usando el endpoint radical
  const retirarExcedentesMutation = useMutation({
    mutationFn: async () => {
      setProcesando(true);
      
      try {
        console.log(`Enviando solicitud al endpoint radical para retirar excedentes del producto ${producto.codigo}`);
        
        const response = await apiRequest(
          "POST", 
          `/api/control/pedidos/${pedidoId}/retirar-excedentes`, 
          {
            codigoProducto: producto.codigo
          }
        );
        
        if (!response.ok) {
          throw new Error(`Error en la respuesta: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Respuesta del servidor para retirada de excedentes:", data);
        
        // Marcar como exitoso para mostrar confirmación
        setExitoso(true);
        
        // Esperar 1.5 segundos antes de cerrar el diálogo y refrescar
        setTimeout(() => {
          onConfirm();
        }, 1500);
        
        return data;
      } catch (error) {
        console.error("Error al retirar excedentes:", error);
        toast({
          title: "Error al retirar excedentes",
          description: "No se pudo completar la operación. Por favor, inténtelo de nuevo.",
          variant: "destructive"
        });
        setProcesando(false);
        throw error;
      }
    }
  });

  const handleConfirmar = () => {
    retirarExcedentesMutation.mutate();
  };

  const cantidadExcedente = producto.controlado - producto.cantidad;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && !procesando) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            ¡ATENCIÓN! Cantidad excedente detectada
          </DialogTitle>
          <DialogDescription>
            Se ha registrado un excedente de productos. Por favor retire {cantidadExcedente} unidad(es).
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 bg-amber-50 rounded-md border border-amber-200">
          <div className="flex items-center gap-3 text-lg mb-2">
            <span className="font-semibold">{producto.codigo}</span>
            <span>{producto.descripcion}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 my-4">
            <div>
              <div className="text-sm text-gray-500 uppercase mb-1">Cantidad Solicitada</div>
              <div className="text-2xl font-bold text-center p-2 bg-white rounded border">
                {producto.cantidad}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-500 uppercase mb-1">Cantidad Registrada</div>
              <div className="text-2xl font-bold text-center p-2 bg-white rounded border text-orange-600">
                {producto.controlado}
              </div>
            </div>
          </div>
          
          <div className="bg-red-100 border border-red-300 rounded p-3 mt-4">
            <div className="text-sm text-red-600 uppercase mb-1 text-center">EXCEDENTE A RETIRAR</div>
            <div className="text-3xl font-bold text-center text-red-600">
              {cantidadExcedente}
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-center gap-4 mt-2">
          {!procesando && !exitoso && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={procesando}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                className="bg-orange-600 hover:bg-orange-700"
                onClick={handleConfirmar}
                disabled={procesando}
              >
                He retirado el excedente
              </Button>
            </>
          )}
          
          {procesando && !exitoso && (
            <div className="flex flex-col items-center justify-center w-full">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
              <p className="text-sm text-gray-500 mt-2">Procesando la retirada de excedentes...</p>
            </div>
          )}
          
          {exitoso && (
            <div className="flex flex-col items-center justify-center w-full">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <p className="text-sm text-green-600 font-medium mt-2">¡Retirada de excedentes registrada correctamente!</p>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
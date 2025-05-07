import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductoControlado } from "@shared/types";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RetirarExcedenteDialogNuevoProps {
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
}: RetirarExcedenteDialogNuevoProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  // Calcular el excedente
  const excedente = producto.controlado - producto.cantidad;
  
  // Mutación para retirar excedentes usando el nuevo endpoint de ajuste
  const retirarExcedenteMutation = useMutation({
    mutationFn: async () => {
      setIsProcessing(true);
      
      // Usar el nuevo endpoint de ajuste-excedente para manejar correctamente los productos retirados
      const response = await apiRequest(
        "POST", 
        `/api/control/pedidos/${pedidoId}/ajuste-excedente`, 
        { 
          codigo: producto.codigo,
          cantidadCorrecta: producto.cantidad // Enviar la cantidad correcta que debe quedar
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al ajustar excedente");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setIsSuccess(true);
      toast({
        title: "Excedente retirado",
        description: `Se retiró ${excedente} unidad(es) excedente(s) de ${producto.codigo}`,
      });
      
      // Esperar un momento antes de cerrar para mostrar el éxito
      setTimeout(() => {
        onConfirm();
      }, 1500);
    },
    onError: (error: Error) => {
      setIsProcessing(false);
      toast({
        title: "Error",
        description: error.message || "No se pudo retirar el excedente",
        variant: "destructive",
      });
      onClose();
    }
  });
  
  // Manejar acción de confirmar
  const handleConfirm = () => {
    retirarExcedenteMutation.mutate();
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
            Retirar Excedente
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-center font-medium">¡Excedente retirado con éxito!</p>
                <p className="text-center text-sm">
                  Se retiró {excedente} unidad(es) excedente(s) de {producto.codigo}
                </p>
              </div>
            ) : (
              <>
                <p>
                  El producto <span className="font-semibold">{producto.codigo}</span> tiene un 
                  excedente de <span className="font-semibold text-red-500">{excedente} unidad(es)</span>.
                </p>
                <p className="mt-2 font-medium">
                  ¿Confirma que ha retirado {excedente} unidad(es) del producto?
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Al confirmar, la cantidad se ajustará de {producto.controlado} a {producto.cantidad} unidades.
                </p>
                <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 mt-3">
                  <p className="text-yellow-800 text-sm flex items-start">
                    <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 text-yellow-600 flex-shrink-0" />
                    Esta acción eliminará los registros anteriores y creará un nuevo registro con la cantidad correcta.
                  </p>
                  <p className="text-yellow-800 text-sm mt-2 flex items-start">
                    <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 text-yellow-600 flex-shrink-0" />
                    Los excedentes retirados no se contabilizarán en futuros escaneos.
                  </p>
                </div>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {isSuccess ? (
            <AlertDialogAction onClick={onConfirm}>
              Cerrar
            </AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirm();
                }}
                disabled={isProcessing}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Retirar excedente"
                )}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
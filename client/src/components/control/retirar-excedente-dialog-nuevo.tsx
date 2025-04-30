import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { ProductoControlado } from "@shared/types";
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
  const [procesando, setProcesando] = useState(false);
  const [completado, setCompletado] = useState(false);
  const { toast } = useToast();
  
  // Calcular excedente
  const excedente = producto.controlado - producto.cantidad;
  
  // Retirar excedente mutation
  const retirarExcedenteMutation = useMutation({
    mutationFn: async () => {
      setProcesando(true);
      
      const response = await apiRequest(
        "POST", 
        `/api/control/pedidos/${pedidoId}/retirar-excedente`, 
        {
          codigo: producto.codigo,
          cantidad: excedente
        }
      );
      
      if (!response.ok) {
        throw new Error("Error al retirar excedente");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Excedente retirado con éxito:", data);
      setProcesando(false);
      setCompletado(true);
      
      // Mostrar confirmación
      toast({
        title: "Excedente retirado",
        description: `Se ha ajustado la cantidad del producto ${producto.codigo}`,
      });
      
      // Esperar breve momento para mostrar el estado completado
      setTimeout(() => {
        setCompletado(false);
        onConfirm();
      }, 1000);
    },
    onError: (error) => {
      console.error("Error al retirar excedente:", error);
      setProcesando(false);
      
      toast({
        title: "Error",
        description: "No se pudo retirar el excedente del producto",
        variant: "destructive"
      });
    }
  });
  
  const handleConfirmar = () => {
    retirarExcedenteMutation.mutate();
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !procesando && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Excedente Detectado
          </DialogTitle>
          <DialogDescription>
            Ha escaneado más unidades de las requeridas para este producto.
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold">{producto.codigo}</p>
              <p className="text-sm text-gray-600">{producto.descripcion}</p>
            </div>
            <div className="text-lg font-bold text-red-600">
              {producto.controlado}/{producto.cantidad}
            </div>
          </div>
          
          <div className="bg-white p-3 rounded border border-red-100">
            <div className="flex justify-between items-center">
              <span>Cantidad requerida:</span>
              <span className="font-bold">{producto.cantidad}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span>Cantidad escaneada:</span>
              <span className="font-bold">{producto.controlado}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span>Excedente a retirar:</span>
              <span className="font-bold text-red-600">{excedente}</span>
            </div>
          </div>
          
          <p className="mt-3 text-sm text-gray-600">
            Por favor retire {excedente} unidad(es) del producto y confirme para continuar.
          </p>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={procesando || completado}
          >
            Cancelar
          </Button>
          
          <Button 
            variant={completado ? "default" : "destructive"}
            onClick={handleConfirmar}
            disabled={procesando || completado}
            className={completado ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {procesando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : completado ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Completado
              </>
            ) : (
              "Confirmar Retirada"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
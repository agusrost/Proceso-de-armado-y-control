import { AlertCircle, Package, ArrowRight, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ProductoExcedenteAlertProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codigo: string;
  descripcion?: string;
  cantidadEsperada: number;
  cantidadActual: number;
  onConfirm?: () => void;
};

export function ProductoExcedenteAlert({
  open,
  onOpenChange,
  codigo,
  descripcion = "Sin descripción",
  cantidadEsperada,
  cantidadActual,
  onConfirm
}: ProductoExcedenteAlertProps) {
  const excedente = cantidadActual - cantidadEsperada;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
            ¡ATENCIÓN! Cantidad excedente detectada
          </DialogTitle>
          <DialogDescription className="text-red-600 font-semibold text-base">
            Se ha registrado un excedente de productos. Por favor retire {excedente} unidad(es).
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 gap-4 py-4 border-y-2 border-amber-100 my-2 bg-amber-50 p-4 rounded-md">
          <div>
            <div className="flex items-center">
              <Package className="mr-2 h-5 w-5 text-amber-600" />
              <p className="text-lg font-bold">{codigo}</p>
            </div>
            <p className="text-md mt-1">{descripcion}</p>
          </div>
          
          <div className="flex items-center justify-center gap-6 my-2">
            <div className="text-center">
              <p className="text-xs uppercase mb-1">Cantidad Solicitada</p>
              <p className="text-xl font-bold border rounded-full py-2 px-4 bg-white">{cantidadEsperada}</p>
            </div>
            <ArrowRight className="h-6 w-6 text-neutral-400" />
            <div className="text-center">
              <p className="text-xs uppercase mb-1">Cantidad Registrada</p>
              <p className="text-xl font-bold border rounded-full py-2 px-4 text-amber-600 bg-white">{cantidadActual}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-center mt-2 bg-red-50 p-3 rounded-lg border-2 border-red-100">
            <MinusCircle className="h-6 w-6 text-red-500 mr-2" />
            <div className="text-center">
              <p className="text-xs uppercase mb-1 text-red-600">Excedente a retirar</p>
              <p className="text-2xl font-bold text-red-600">{excedente}</p>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            className="w-full bg-amber-600 hover:bg-amber-700 text-white" 
            onClick={() => {
              if (onConfirm) onConfirm();
              onOpenChange(false);
            }}
          >
            He retirado el excedente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
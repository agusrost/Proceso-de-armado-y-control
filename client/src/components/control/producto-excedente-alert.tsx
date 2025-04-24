import { AlertCircle } from "lucide-react";
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
            Cantidad excedente detectada
          </DialogTitle>
          <DialogDescription>
            Se ha detectado un excedente en este producto. Por favor retire {excedente} unidad(es).
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 gap-4 py-4">
          <div>
            <p className="text-sm font-medium mb-1">Código:</p>
            <p className="text-lg font-bold">{codigo}</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Descripción:</p>
            <p className="text-lg">{descripcion}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium mb-1">Cantidad esperada:</p>
              <p className="text-lg font-bold">{cantidadEsperada}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Cantidad actual:</p>
              <p className="text-lg font-bold text-amber-600">{cantidadActual}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Excedente a retirar:</p>
            <p className="text-lg font-bold text-amber-600">{excedente}</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={() => {
            if (onConfirm) onConfirm();
            onOpenChange(false);
          }}>He retirado el excedente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CodigoNoEncontradoAlertProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codigo: string;
  descripcion?: string;
};

export function CodigoNoEncontradoAlert({
  open,
  onOpenChange,
  codigo,
  descripcion = "Sin descripción"
}: CodigoNoEncontradoAlertProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            Código no encontrado en el pedido
          </DialogTitle>
          <DialogDescription>
            El código escaneado no pertenece a este pedido. Por favor retírelo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div>
            <p className="text-sm font-medium mb-1">Código:</p>
            <p className="text-lg font-bold">{codigo}</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Descripción:</p>
            <p className="text-lg">{descripcion}</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Aceptar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";

interface ControlFinalizadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensaje?: string;
}

export function ControlFinalizadoDialog({
  open,
  onOpenChange,
  mensaje = "Control finalizado correctamente",
}: ControlFinalizadoDialogProps) {
  const [_, setLocation] = useLocation();

  const handleOk = () => {
    onOpenChange(false);
    setLocation("/control");
  };

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
        <div className="flex justify-center py-4">
          <div className="text-center">
            <p className="text-lg font-medium text-gray-700">
              El control ha sido completado con éxito.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Todos los productos han sido verificados correctamente.
            </p>
          </div>
        </div>
        <DialogFooter className="flex justify-center sm:justify-center">
          <Button onClick={handleOk} className="px-8">
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
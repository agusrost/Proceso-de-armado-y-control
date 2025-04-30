import React from "react";
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
import { AlertTriangle } from "lucide-react";

export interface RetirarExcedenteAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excedentes: Array<{
    codigo: string;
    descripcion: string;
    cantidadExcedente: number;
  }>;
  onRetirarConfirm: () => void;
}

export function RetirarExcedenteAlert({ 
  open, 
  onOpenChange, 
  excedentes,
  onRetirarConfirm 
}: RetirarExcedenteAlertProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <AlertDialogTitle>Excedentes Pendientes de Retirar</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="py-4">
            <p className="mb-4">
              Hay productos con cantidades excedentes que deben ser retirados para completar el control.
            </p>
            
            <div className="border rounded-md p-3 bg-amber-50 mb-4">
              <h4 className="font-semibold mb-2">Productos excedentes a retirar:</h4>
              <ul className="space-y-2">
                {excedentes.map((item, index) => (
                  <li key={index} className="flex justify-between items-center border-b pb-2 last:border-0">
                    <div>
                      <span className="font-medium">{item.codigo}</span>
                      {item.descripcion && (
                        <p className="text-sm text-neutral-600">{item.descripcion}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-semibold text-amber-700 text-lg">
                        +{item.cantidadExcedente} unidad{item.cantidadExcedente !== 1 ? 'es' : ''}
                      </span>
                      <span className="text-xs text-amber-600">Retirar esta cantidad</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 bg-amber-100 p-2 rounded-md border border-amber-200">
                <p className="text-sm text-amber-800 font-semibold text-center">
                  Por favor, retire exactamente la cantidad indicada para cada producto.
                </p>
              </div>
            </div>
            
            <p>
              ¿Confirma que ha retirado estos excedentes y desea completar el control?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onRetirarConfirm}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Confirmar Retiro
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
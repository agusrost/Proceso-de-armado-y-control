import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Check } from "lucide-react";

interface ControlFinalizarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinalizar: (resultado: string) => void;
  comentarios: string;
  onComentariosChange: (comentarios: string) => void;
  hasFaltantes: boolean;
  hasExcedentes: boolean;
}

export function ControlFinalizarDialog({ 
  open, 
  onOpenChange, 
  onFinalizar, 
  comentarios, 
  onComentariosChange,
  hasFaltantes,
  hasExcedentes
}: ControlFinalizarDialogProps) {
  // Determinar el resultado más probable basado en las anomalías
  const recomendedResult = hasFaltantes 
    ? 'faltantes' 
    : hasExcedentes 
      ? 'excedentes' 
      : 'completo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Finalizar Control de Pedido</DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que deseas finalizar el control?
          </DialogDescription>
        </DialogHeader>
        
        {(hasFaltantes || hasExcedentes) && (
          <div className="flex items-start p-3 gap-3 bg-amber-50 border border-amber-200 rounded-md mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Anomalías detectadas</p>
              <p className="text-sm text-amber-700">
                {hasFaltantes && 'Hay productos faltantes en el control.'}
                {hasFaltantes && hasExcedentes && ' '}
                {hasExcedentes && 'Hay productos con cantidades excedentes.'}
              </p>
            </div>
          </div>
        )}
        
        <div>
          <Label htmlFor="comentarios" className="mb-2 block">
            Comentarios (opcional)
          </Label>
          <Textarea
            id="comentarios"
            value={comentarios}
            onChange={(e) => onComentariosChange(e.target.value)}
            placeholder="Agrega comentarios sobre este control..."
            rows={4}
          />
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          
          {recomendedResult === 'completo' ? (
            <Button 
              onClick={() => onFinalizar('completo')}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="mr-2 h-4 w-4" />
              Finalizar como Completo
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={() => onFinalizar('completo')}
                variant="outline" 
                className="text-green-600 border-green-600 hover:bg-green-50"
              >
                <Check className="mr-2 h-4 w-4" />
                Finalizar como Completo
              </Button>
              
              {hasFaltantes && (
                <Button 
                  onClick={() => onFinalizar('faltantes')} 
                  className="bg-red-600 hover:bg-red-700"
                >
                  Finalizar con Faltantes
                </Button>
              )}
              
              {!hasFaltantes && hasExcedentes && (
                <Button 
                  onClick={() => onFinalizar('excedentes')} 
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  Finalizar con Excedentes
                </Button>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
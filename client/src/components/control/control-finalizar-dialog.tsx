import { useState, useEffect } from "react";
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

export function ControlFinalizarDialog(props: ControlFinalizarDialogProps) {
  const { 
    open, 
    onOpenChange, 
    onFinalizar, 
    comentarios, 
    onComentariosChange,
    hasFaltantes,
    hasExcedentes
  } = props;
  
  // Estado local para el resultado seleccionado
  const [resultado, setResultado] = useState<string>("completo");
  
  // Actualizar el resultado cuando cambian las condiciones
  useEffect(() => {
    if (hasFaltantes) {
      setResultado("faltantes");
    } else if (hasExcedentes) {
      setResultado("excedentes");
    } else {
      setResultado("completo");
    }
  }, [hasFaltantes, hasExcedentes, open]);
  
  return (
    <Dialog 
      open={open} 
      onOpenChange={onOpenChange}
    >
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
        
        <div className="space-y-4">
          {/* Radio buttons para seleccionar el resultado */}
          <div>
            <Label htmlFor="resultado" className="mb-2 block">
              Resultado del control
            </Label>
            <div className="mt-1 space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="resultado-completo"
                  name="resultado"
                  value="completo"
                  checked={resultado === 'completo'}
                  onChange={() => setResultado('completo')}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                />
                <Label htmlFor="resultado-completo" className="text-sm font-medium leading-none cursor-pointer">
                  Completo (todos los productos coinciden)
                </Label>
              </div>
              
              {hasFaltantes && (
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="resultado-faltantes"
                    name="resultado"
                    value="faltantes"
                    checked={resultado === 'faltantes'}
                    onChange={() => setResultado('faltantes')}
                    className="h-4 w-4 text-red-600 focus:ring-red-600 border-gray-300"
                  />
                  <Label htmlFor="resultado-faltantes" className="text-sm font-medium leading-none cursor-pointer text-red-600">
                    Con Faltantes (faltan productos)
                  </Label>
                </div>
              )}
              
              {hasExcedentes && (
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="resultado-excedentes"
                    name="resultado"
                    value="excedentes"
                    checked={resultado === 'excedentes'}
                    onChange={() => setResultado('excedentes')}
                    className="h-4 w-4 text-amber-600 focus:ring-amber-600 border-gray-300"
                  />
                  <Label htmlFor="resultado-excedentes" className="text-sm font-medium leading-none cursor-pointer text-amber-600">
                    Con Excedentes (hay productos de más)
                  </Label>
                </div>
              )}
            </div>
          </div>
          
          {/* Comentarios */}
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
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          
          <Button 
            onClick={() => onFinalizar(resultado)}
            className={
              resultado === 'completo' 
                ? 'bg-green-600 hover:bg-green-700' 
                : resultado === 'faltantes'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-amber-600 hover:bg-amber-700'
            }
          >
            <Check className="mr-2 h-4 w-4" />
            Finalizar Control
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
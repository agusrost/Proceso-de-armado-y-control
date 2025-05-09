import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Barcode, ScanLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductoEscanerSeguroProps {
  onEscaneo: (codigo: string, cantidad?: number) => Promise<void>;
  allowOverflow?: boolean;
  buttonText?: string;
  showEscanerAutomatico?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ProductoEscanerSeguroV2({
  onEscaneo,
  allowOverflow = false,
  buttonText = "Registrar",
  showEscanerAutomatico = true,
  disabled = false,
  className = ""
}: ProductoEscanerSeguroProps) {
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Focus en el input al montar el componente
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Manejar envío de formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!codigo.trim() || isLoading || disabled || cantidad <= 0) {
      return;
    }
    
    try {
      setIsLoading(true);
      await onEscaneo(codigo.trim(), cantidad);
      setCodigo("");
      // Reiniciar la cantidad a 1 después de cada escaneo
      setCantidad(1);
      
      // Foco en input de código
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 10); // Breve retraso para asegurar que el foco funcione correctamente
    } catch (error) {
      console.error("Error en escaneo:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar cambio en el código (y envío automático si se escanea con lector)
  const handleCodigoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Si el componente está deshabilitado, no procesar cambios
    if (disabled) return;
    
    setCodigo(e.target.value);
    
    // Si el cambio termina con un salto de línea o retorno de carro, enviar automáticamente
    // Esto ocurre generalmente cuando se usa un lector de códigos de barras 
    if (showEscanerAutomatico && (e.target.value.includes('\n') || e.target.value.includes('\r'))) {
      const limpioCodigo = e.target.value.replace(/[\n\r]/g, '');
      setCodigo(limpioCodigo);
      
      setTimeout(async () => {
        // Verificar nuevamente que no esté deshabilitado antes de enviar
        if (!disabled && !isLoading && limpioCodigo.trim()) {
          try {
            setIsLoading(true);
            await onEscaneo(limpioCodigo.trim(), cantidad);
            setCodigo("");
            // Reiniciar la cantidad a 1 después de cada escaneo
            setCantidad(1);
            
            // Foco en input de código
            setTimeout(() => {
              if (inputRef.current) {
                inputRef.current.focus();
              }
            }, 10); // Breve retraso para asegurar que el foco funcione correctamente
          } catch (error) {
            console.error("Error en escaneo automático:", error);
          } finally {
            setIsLoading(false);
          }
        }
      }, 0);
    }
  };

  return (
    <Card className={`shadow-md ${className}`}>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <div className="flex items-center mb-1">
              <Barcode className="h-4 w-4 mr-1" />
              <label className="text-sm font-medium">Código de producto</label>
            </div>
            <div className="relative">
              <Input
                ref={inputRef}
                value={codigo}
                onChange={handleCodigoChange}
                placeholder="Escanea o ingresa el código"
                className="pr-10"
                disabled={isLoading || disabled}
              />
              <ScanLine 
                className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Cantidad</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCantidad(prev => Math.max(1, prev - 1))}
                disabled={isLoading || cantidad <= 1 || disabled}
                className="h-9 w-9 p-0"
              >
                -
              </Button>
              <Input
                type="number"
                min={1}
                value={cantidad === 0 ? "" : cantidad}
                onChange={(e) => {
                  // Si el campo está vacío, permitimos que quede en blanco momentáneamente
                  // estableciendo el valor en cero (pero en la UI mostrará campo vacío)
                  if (e.target.value === "") {
                    setCantidad(0);
                  } else {
                    const parsedValue = parseInt(e.target.value);
                    setCantidad(isNaN(parsedValue) ? 0 : parsedValue);
                  }
                }}
                className="text-center"
                disabled={isLoading || disabled}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCantidad(prev => prev + 1)}
                disabled={isLoading || disabled}
                className="h-9 w-9 p-0"
              >
                +
              </Button>
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={!codigo.trim() || isLoading || disabled || cantidad < 1}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              buttonText
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
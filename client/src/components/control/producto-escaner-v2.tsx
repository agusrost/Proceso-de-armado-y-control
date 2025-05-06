import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Barcode, ScanLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductoEscanerSeguroProps {
  onEscaneo: (codigo: string) => Promise<void>;
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
    
    if (!codigo.trim() || isLoading || disabled) {
      return;
    }
    
    try {
      setIsLoading(true);
      await onEscaneo(codigo.trim());
      setCodigo("");
      
      // Foco en input de código
      if (inputRef.current) {
        inputRef.current.focus();
      }
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
            await onEscaneo(limpioCodigo.trim());
            setCodigo("");
            
            // Foco en input de código
            if (inputRef.current) {
              inputRef.current.focus();
            }
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
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={!codigo.trim() || isLoading || disabled}
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
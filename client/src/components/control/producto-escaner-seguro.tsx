import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Barcode, ScanLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductoEscanerSeguroProps {
  pedidoId: number;
  className?: string;
  onEscaneoSuccess?: (result: any) => void;
  onEscaneoError?: (error: Error) => void;
  disabled?: boolean;
}

export function ProductoEscanerSeguro({
  pedidoId,
  className = "",
  onEscaneoSuccess,
  onEscaneoError,
  disabled = false
}: ProductoEscanerSeguroProps) {
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Mutación para enviar el escaneo al servidor
  const escanearMutation = useMutation({
    mutationFn: async () => {
      if (!codigo.trim()) {
        throw new Error("Debe ingresar un código de producto");
      }

      if (isNaN(cantidad) || cantidad <= 0) {
        throw new Error("La cantidad debe ser un número mayor a 0");
      }

      const response = await fetch(`/api/control/pedidos/${pedidoId}/escanear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          codigo: codigo.trim(),
          cantidad
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al escanear producto");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Limpiar formulario
      setCodigo("");
      setCantidad(1);
      
      // Foco en input de código
      if (inputRef.current) {
        inputRef.current.focus();
      }
      
      // Callback de éxito
      if (onEscaneoSuccess) {
        onEscaneoSuccess(data);
      }
    },
    onError: (error: Error) => {
      // Mostrar error
      toast({
        title: "Error al escanear",
        description: error.message,
        variant: "destructive"
      });
      
      // Seleccionar todo el texto para facilitar reescaneo
      if (inputRef.current) {
        inputRef.current.select();
      }
      
      // Callback de error
      if (onEscaneoError) {
        onEscaneoError(error);
      }
    }
  });

  // Focus en el input al montar el componente
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  // Devolver el foco al input después de cada envío exitoso o error
  useEffect(() => {
    if (escanearMutation.isSuccess || escanearMutation.isError) {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [escanearMutation.isSuccess, escanearMutation.isError]);

  // Manejar envío de formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    escanearMutation.mutate();
  };

  // Manejar cambio en el código (y envío automático si se escanea con lector)
  const handleCodigoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCodigo(e.target.value);
    
    // Si el cambio termina con un salto de línea o retorno de carro, enviar automáticamente
    // Esto ocurre generalmente cuando se usa un lector de códigos de barras 
    if (e.target.value.includes('\n') || e.target.value.includes('\r')) {
      const limpioCodigo = e.target.value.replace(/[\n\r]/g, '');
      setCodigo(limpioCodigo);
      setCantidad(1);
      setTimeout(() => {
        escanearMutation.mutate();
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
                disabled={escanearMutation.isPending || disabled}
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
                disabled={escanearMutation.isPending || cantidad <= 1 || disabled}
                className="h-9 w-9 p-0"
              >
                -
              </Button>
              <Input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                className="text-center"
                disabled={escanearMutation.isPending || disabled}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCantidad(prev => prev + 1)}
                disabled={escanearMutation.isPending || disabled}
                className="h-9 w-9 p-0"
              >
                +
              </Button>
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={!codigo.trim() || escanearMutation.isPending}
          >
            {escanearMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              "Registrar"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
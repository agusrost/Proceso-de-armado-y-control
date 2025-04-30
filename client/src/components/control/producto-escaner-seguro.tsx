import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Barcode, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProductoEscanerSeguroProps {
  pedidoId: number;
  onEscanearSuccess?: (data: any) => void;
  onEscanearError?: (error: any) => void;
  disabled?: boolean;
}

export function ProductoEscanerSeguro({ 
  pedidoId,
  onEscanearSuccess,
  onEscanearError,
  disabled = false
}: ProductoEscanerSeguroProps) {
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Escanear producto
  const escanearMutation = useMutation({
    mutationFn: async () => {
      if (!codigo) {
        throw new Error("Código de producto requerido");
      }
      
      const response = await apiRequest(
        "POST", 
        `/api/control/pedidos/${pedidoId}/escanear`, 
        {
          codigo: codigo.trim(),
          cantidad
        }
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Producto no encontrado en este pedido");
        }
        throw new Error("Error al escanear el producto");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Escaneo exitoso:", data);
      
      // Limpiar campos después de éxito
      setCodigo("");
      setCantidad(1);
      
      // Enfocar el campo de código para el siguiente escaneo
      if (inputRef.current) {
        inputRef.current.focus();
      }
      
      // Llamar al callback de éxito si existe
      if (onEscanearSuccess) {
        onEscanearSuccess(data);
      }
    },
    onError: (error: any) => {
      console.error("Error al escanear:", error);
      
      // Si no es "Producto no encontrado", mostrar toast
      if (error.message !== "Producto no encontrado en este pedido") {
        toast({
          title: "Error",
          description: error.message || "No se pudo escanear el producto",
          variant: "destructive"
        });
      }
      
      // Enfocar el campo de código para intentar de nuevo
      if (inputRef.current) {
        inputRef.current.focus();
      }
      
      // Llamar al callback de error si existe
      if (onEscanearError) {
        onEscanearError(error);
      }
    }
  });

  // Auto focus en montar
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Manejar envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || escanearMutation.isPending) return;
    
    escanearMutation.mutate();
  };

  // Manejar cambio en código
  const handleCodigoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCodigo(e.target.value);
  };

  // Manejar cambio en cantidad
  const handleCantidadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setCantidad(isNaN(value) || value < 1 ? 1 : value);
  };

  return (
    <Card className={`${disabled ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle>Escanear Producto</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="codigo" className="text-sm text-gray-500 block mb-2">
              Código de Producto
            </label>
            <div className="flex">
              <div className="flex-shrink-0 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md p-2">
                <Barcode className="h-5 w-5 text-gray-500" />
              </div>
              <Input 
                id="codigo" 
                ref={inputRef}
                placeholder="Escanee o ingrese el código"
                value={codigo}
                onChange={handleCodigoChange}
                className="rounded-l-none focus:ring-2 focus:ring-primary"
                disabled={disabled || escanearMutation.isPending}
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="cantidad" className="text-sm text-gray-500 block mb-2">
              Cantidad
            </label>
            <Input 
              id="cantidad"
              type="number"
              min="1"
              value={cantidad}
              onChange={handleCantidadChange}
              className="focus:ring-2 focus:ring-primary"
              disabled={disabled || escanearMutation.isPending}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full"
            disabled={disabled || escanearMutation.isPending || !codigo}
          >
            {escanearMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Barcode className="mr-2 h-4 w-4" />
                Registrar Producto
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
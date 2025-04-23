import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Pedido } from "@shared/schema";
import { Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SearchPedidoFormProps {
  onPedidoFound: (pedido: Pedido) => void;
  onError: (error: string | null) => void;
}

export function SearchPedidoForm({ onPedidoFound, onError }: SearchPedidoFormProps) {
  const [pedidoId, setPedidoId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pedidoId.trim()) {
      onError("Por favor ingresa un ID de pedido válido");
      return;
    }
    
    setIsLoading(true);
    onError(null);
    
    try {
      const res = await apiRequest("GET", `/api/pedidos/buscar?id=${encodeURIComponent(pedidoId.trim())}`);
      
      if (!res.ok) {
        if (res.status === 404) {
          onError("Pedido no encontrado");
        } else {
          const errorData = await res.json();
          onError(errorData.message || "Error al buscar el pedido");
        }
        return;
      }
      
      const pedido = await res.json();
      onPedidoFound(pedido);
    } catch (error) {
      onError("Error al buscar el pedido");
      console.error("Error al buscar pedido:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3">
          <Label htmlFor="pedido-id">ID del Pedido</Label>
          <Input
            id="pedido-id"
            value={pedidoId}
            onChange={(e) => setPedidoId(e.target.value)}
            placeholder="Ej: P0001, 12345-A, etc."
            className="mt-1"
            disabled={isLoading}
          />
        </div>
        <div className="flex items-end">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !pedidoId.trim()}
          >
            {isLoading ? (
              "Buscando..."
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Buscar
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
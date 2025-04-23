import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Pedido } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface SearchPedidoFormProps {
  onPedidoFound: (pedido: Pedido) => void;
  onError: (error: string | null) => void;
}

export function SearchPedidoForm({ onPedidoFound, onError }: SearchPedidoFormProps) {
  const { toast } = useToast();
  const [pedidoId, setPedidoId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pedidoId.trim()) {
      onError("Debes ingresar un ID de pedido");
      return;
    }
    
    setIsLoading(true);
    onError(null);
    
    try {
      const res = await apiRequest("GET", `/api/pedido/buscar/${pedidoId.trim()}`);
      
      if (!res.ok) {
        const errorData = await res.json();
        onError(errorData.message || "No se encontró el pedido");
        return;
      }
      
      const pedido = await res.json();
      onPedidoFound(pedido);
    } catch (error) {
      toast({
        title: "Error al buscar pedido",
        description: "Ocurrió un error al conectar con el servidor",
        variant: "destructive",
      });
      onError("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSearch} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3">
          <Label htmlFor="pedido-id">ID de Pedido</Label>
          <Input
            id="pedido-id"
            value={pedidoId}
            onChange={(e) => setPedidoId(e.target.value)}
            placeholder="Ingresa el ID o código del pedido"
            disabled={isLoading}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full" disabled={isLoading}>
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
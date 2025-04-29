import { useState } from "react";
import { Producto } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Plus, Check } from "lucide-react";

interface ProductoRowProps {
  producto: Producto;
  isActive: boolean;
  onComplete: () => void;
}

export default function ProductoRow({ producto, isActive, onComplete }: ProductoRowProps) {
  const { toast } = useToast();
  const [recolectado, setRecolectado] = useState(producto.recolectado || 0);
  const [motivo, setMotivo] = useState(producto.motivo || "");
  
  const updateProductoMutation = useMutation({
    mutationFn: async () => {
      const needsMotivo = recolectado < producto.cantidad;
      
      if (needsMotivo && !motivo) {
        throw new Error("Se requiere un motivo cuando hay faltantes");
      }
      
      const data = {
        recolectado,
        motivo: needsMotivo ? motivo : null
      };
      
      const res = await apiRequest("PATCH", `/api/productos/${producto.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Producto actualizado",
        description: "El producto ha sido actualizado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/pedidos/${producto.pedidoId}`] });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar producto",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleQuantityChange = (newValue: string) => {
    const value = parseInt(newValue);
    if (!isNaN(value) && value >= 0 && value <= producto.cantidad) {
      setRecolectado(value);
    }
  };
  
  const handleIncrement = () => {
    if (recolectado < producto.cantidad) {
      setRecolectado(recolectado + 1);
    }
  };
  
  const handleSubmit = () => {
    updateProductoMutation.mutate();
  };
  
  const needsMotivo = recolectado < producto.cantidad;
  
  const getRowClass = () => {
    if (!isActive) {
      if (producto.recolectado >= producto.cantidad) {
        return "bg-neutral-200/50"; // Completed
      }
      return ""; // Pending
    }
    return "bg-green-100/50"; // Active
  };
  
  return (
    <tr className={getRowClass()} data-status={
      !isActive 
        ? (producto.recolectado >= producto.cantidad ? "completado" : "pendiente") 
        : "en-curso"
    }>
      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-neutral-800">
        {producto.codigo}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
        {producto.cantidad}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
        {producto.ubicacion || '-'}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-800">
        {producto.descripcion}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
        <div className="flex items-center space-x-2">
          <Input
            type="number"
            className="w-16 px-2 py-1"
            value={recolectado}
            onChange={(e) => handleQuantityChange(e.target.value)}
            min={0}
            max={producto.cantidad}
            disabled={!isActive || updateProductoMutation.isPending}
          />
          {isActive && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleIncrement} 
              disabled={recolectado >= producto.cantidad || updateProductoMutation.isPending}
            >
              <Plus className="h-4 w-4 text-primary" />
            </Button>
          )}
          {isActive && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSubmit}
              disabled={updateProductoMutation.isPending || (needsMotivo && !motivo)}
            >
              <Check className="h-4 w-4 text-success" />
            </Button>
          )}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
        {isActive && needsMotivo ? (
          <Select 
            value={motivo} 
            onValueChange={setMotivo}
            disabled={updateProductoMutation.isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stock">Falta de stock</SelectItem>
              <SelectItem value="no-encontrado">No encontrado</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          producto.motivo || "-"
        )}
      </td>
    </tr>
  );
}

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus } from "lucide-react";

export default function ArmadoSimplePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [cantidad, setCantidad] = useState(0);
  
  // Fetch current pedido assigned to armador
  const { data: pedido, isLoading: isLoadingPedido } = useQuery({
    queryKey: ["/api/pedido-para-armador"],
    enabled: !!user,
  });
  
  // Fetch productos de pedido
  const { data: productos, isLoading: isLoadingProductos } = useQuery({
    queryKey: [`/api/productos/pedido/${pedido?.id}`],
    enabled: !!pedido?.id,
  });
  
  // Estado para el producto actual
  const [currentProductoIndex, setCurrentProductoIndex] = useState(0);
  const [currentProducto, setCurrentProducto] = useState<any>(null);
  
  // Actualizar producto mutation
  const actualizarProductoMutation = useMutation({
    mutationFn: async (params: { id: number, recolectado: number, motivo?: string }) => {
      const res = await apiRequest("PUT", `/api/productos/${params.id}`, {
        recolectado: params.recolectado,
        motivo: params.motivo
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      queryClient.invalidateQueries({ queryKey: [`/api/productos/pedido/${pedido?.id}`] });
      
      // Avanzar al siguiente producto
      if (productos && currentProductoIndex < productos.length - 1) {
        setCurrentProductoIndex(currentProductoIndex + 1);
      } else {
        toast({
          title: "Pedido finalizado",
          description: "Has procesado todos los productos del pedido."
        });
      }
      
      // Resetear cantidad
      setCantidad(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar producto",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Determinar el producto actual basado en el algoritmo de selección
  useEffect(() => {
    if (productos && productos.length > 0) {
      // Buscar el producto 17012
      const index17012 = productos.findIndex((p: any) => p.codigo === "17012");
      
      if (index17012 !== -1) {
        setCurrentProductoIndex(index17012);
      } else {
        // Buscar el primer producto sin procesar
        const primerNoRecolectado = productos.findIndex((p: any) => p.recolectado === null);
        
        if (primerNoRecolectado !== -1) {
          setCurrentProductoIndex(primerNoRecolectado);
        } else {
          // Si todos están procesados parcialmente, buscar el primero incompleto
          const primerIncompleto = productos.findIndex(
            (p: any) => p.recolectado !== null && p.recolectado < p.cantidad
          );
          
          if (primerIncompleto !== -1) {
            setCurrentProductoIndex(primerIncompleto);
          } else {
            // Si todo está completo, usar el primero
            setCurrentProductoIndex(0);
          }
        }
      }
    }
  }, [productos]);
  
  // Actualizar el producto actual cuando cambia el índice
  useEffect(() => {
    if (productos && productos[currentProductoIndex]) {
      setCurrentProducto(productos[currentProductoIndex]);
      // Inicializar cantidad con lo que ya esté recolectado o 0
      setCantidad(productos[currentProductoIndex].recolectado || 0);
    }
  }, [productos, currentProductoIndex]);
  
  // Manejar continuar
  const handleContinuar = () => {
    if (!currentProducto) return;
    
    // Validar cantidad
    if (cantidad > currentProducto.cantidad) {
      toast({
        title: "Cantidad inválida",
        description: `No puedes recolectar más de ${currentProducto.cantidad} unidades`,
        variant: "destructive",
      });
      return;
    }
    
    // Determinar si necesitamos enviar motivo (faltante)
    const motivoParaEnviar = cantidad < currentProducto.cantidad ? "Faltante" : undefined;
    
    // Actualizar producto
    actualizarProductoMutation.mutate({
      id: currentProducto.id,
      recolectado: cantidad,
      motivo: motivoParaEnviar
    });
  };
  
  // Vista de carga
  if (isLoadingPedido || isLoadingProductos || !currentProducto) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
        <h1 className="text-5xl font-bold mb-8">KONECTA</h1>
        <div className="text-center">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center">
      <div className="w-full max-w-md px-4 py-10 flex flex-col items-center">
        <h1 className="text-5xl font-bold mb-12">KONECTA</h1>
        
        <div className="bg-white text-black rounded-lg w-full p-6 mb-6">
          <p className="text-xl font-bold mb-4">Código SKU: {currentProducto.codigo}</p>
          <p className="text-lg mb-2">Cantidad: {currentProducto.cantidad}</p>
          <p className="text-lg mb-2">Ubicación: {currentProducto.ubicacion || "No especificada"}</p>
          <p className="text-lg mb-4">
            Descripción: {currentProducto.descripcion || currentProducto.codigo}
          </p>
          
          <div className="mb-4 flex items-center border rounded-md">
            <button 
              onClick={() => setCantidad(Math.max(0, cantidad - 1))}
              className="px-4 py-2 text-2xl font-bold"
              type="button"
            >
              <Minus size={20} />
            </button>
            
            <Input
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(parseInt(e.target.value) || 0)}
              className="border-0 text-center text-xl"
              min={0}
              max={currentProducto.cantidad}
            />
            
            <button 
              onClick={() => setCantidad(Math.min(currentProducto.cantidad, cantidad + 1))}
              className="px-4 py-2 text-2xl font-bold"
              type="button"
            >
              <Plus size={20} />
            </button>
          </div>
          
          <Button 
            onClick={handleContinuar}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white text-lg py-6"
            disabled={actualizarProductoMutation.isPending}
          >
            {actualizarProductoMutation.isPending ? "Procesando..." : "CONTINUAR"}
          </Button>
        </div>
        
        <Button 
          variant="outline" 
          className="border-white text-white hover:bg-slate-800 w-full py-6 text-lg"
          onClick={() => window.location.href = "/armado"}
        >
          Ver todo el pedido
        </Button>
      </div>
    </div>
  );
}
import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function ArmadorPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Fetch current pedido assigned to armador
  const { data: pedido, isLoading } = useQuery({
    queryKey: ["/api/pedido-para-armador"],
    enabled: !!user,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
  
  // Start pedido mutation
  const startPedidoMutation = useMutation({
    mutationFn: async () => {
      if (!pedido) return null;
      
      // @ts-ignore - Ignoramos el error de tipo porque sabemos que pedido.id existe
      const res = await apiRequest("POST", `/api/pedidos/${pedido.id}/iniciar`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      setLocation("/armado");
    },
    onError: (error: Error) => {
      toast({
        title: "Error al iniciar armado",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleStartArmado = () => {
    startPedidoMutation.mutate();
  };
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Nueva interfaz minimalista según imagen exacta
  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-gray-800">
        <div className="container mx-auto flex justify-between items-center py-3 px-4">
          <div className="flex items-center">
            <div className="text-xl font-bold mr-2">Konecta Repuestos</div>
            <div className="text-sm text-gray-400">Sistema de Gestión</div>
          </div>
          <div className="flex items-center">
            <span className="text-sm mr-2">{user?.username}</span>
            <span className="text-xs text-gray-400">(Armador)</span>
          </div>
        </div>
      </header>
      
      {/* Contenido central */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-12">KONECTA</h1>
          
          {!isLoading && (
            <Button 
              onClick={handleStartArmado}
              className="bg-white hover:bg-gray-200 text-slate-900 font-semibold text-xl px-8 py-6 h-auto rounded-lg mb-12"
              disabled={startPedidoMutation.isPending}
            >
              COMENZAR
            </Button>
          )}
          
          <div className="mt-8">
            <Button 
              variant="ghost" 
              className="text-white/80 hover:text-white"
              onClick={handleLogout}
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
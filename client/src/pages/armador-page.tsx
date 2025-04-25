import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <div className="text-center px-4 py-12">
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
        
        <div className="mt-12">
          <p className="text-lg mb-2">Usuario: <span className="font-semibold">{user?.firstName || user?.username}</span></p>
          
          <Button 
            variant="ghost" 
            className="text-white/80 hover:text-white mt-2"
            onClick={handleLogout}
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layouts/main-layout";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import PedidoDetailModal from "@/components/pedidos/pedido-detail-modal";
import { useLocation } from "wouter";

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function ArmadorPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const [activePausaId, setActivePausaId] = useState<number | null>(null);
  const [isPausaModalOpen, setIsPausaModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
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
      setIsRunning(true);
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
  
  // Efecto para determinar el primer producto sin procesar cuando se selecciona un pedido
  useEffect(() => {
    if (pedido && pedido.productos && pedido.estado === 'en-proceso') {
      // Diagnosticar productos
      console.log("PRODUCTOS:", pedido.productos.map(p => ({
        codigo: p.codigo,
        recolectado: p.recolectado,
        cantidad: p.cantidad
      })));
      
      // ALGORITMO CORREGIDO - Buscar el primer producto sin procesar
      const primerSinProcesar = pedido.productos.findIndex(p => p.recolectado === null);
      console.log("Índice del primer producto sin procesar:", primerSinProcesar);
      
      if (primerSinProcesar !== -1) {
        console.log(`Seleccionando producto sin procesar: ${pedido.productos[primerSinProcesar].codigo}`);
        setActiveProductIndex(primerSinProcesar);
      } else {
        // Si todos tienen algún valor de recolectado, buscar uno incompleto
        const primerIncompleto = pedido.productos.findIndex(p => 
          p.recolectado !== null && p.recolectado < p.cantidad
        );
        
        if (primerIncompleto !== -1) {
          console.log(`Seleccionando producto incompleto: ${pedido.productos[primerIncompleto].codigo}`);
          setActiveProductIndex(primerIncompleto);
        } else {
          console.log("Todos los productos están procesados o completos, seleccionando índice 0");
          setActiveProductIndex(0);
        }
      }
    }
  }, [pedido]);

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
            className="bg-white hover:bg-gray-200 text-slate-900 font-semibold text-xl px-8 py-6 h-auto rounded-lg"
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
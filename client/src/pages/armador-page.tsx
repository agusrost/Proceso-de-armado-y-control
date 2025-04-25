import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ArmadorPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Fetch current pedido assigned to armador
  const { data: pedido, isLoading, error } = useQuery({
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
      // Cambiamos el enfoque de navegación para forzar que sea efectivo
      window.location.href = '/armado-simple';
    },
    onError: (error: Error) => {
      setShowError(true);
      setErrorMessage(error.message || "El pedido ya no está pendiente");
    }
  });
  
  const handleStartArmado = () => {
    startPedidoMutation.mutate();
  };
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Verificar si hay un pedido en proceso
  const [buttonText, setButtonText] = useState("COMENZAR");
  
  useEffect(() => {
    if (pedido) {
      // @ts-ignore - Ignoramos el error de tipo
      if (pedido.estado === 'en-proceso') {
        setButtonText("CONTINUAR ARMADO");
      } else {
        setButtonText("COMENZAR");
      }
    }
  }, [pedido]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      {/* Mensaje de error */}
      {showError && (
        <div className="absolute top-10 left-0 right-0 mx-auto max-w-md">
          <Alert variant="destructive" className="bg-red-500 text-white border-0">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {errorMessage || "El pedido ya no está pendiente"}
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      <div className="text-center px-4 py-12">
        <h1 className="text-5xl font-bold mb-14">KONECTA</h1>
        
        {!isLoading && (
          <Button 
            onClick={handleStartArmado}
            className="bg-white hover:bg-gray-200 text-slate-900 font-semibold text-xl px-12 py-6 h-auto rounded-lg mb-16"
            disabled={startPedidoMutation.isPending}
          >
            {buttonText}
          </Button>
        )}
        
        <div className="mt-12">
          <p className="text-lg mb-2">Usuario: <span className="font-semibold">{user?.username}</span></p>
          
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
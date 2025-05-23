import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

// Función para formatear el tiempo restante en minutos y segundos
const formatTiempoRestante = (ms: number): string => {
  if (ms <= 0) return "0:00";
  
  // Convertir a segundos y asegurar que no sea negativo
  const segundosTotales = Math.max(0, Math.floor(ms / 1000));
  
  // Extraer minutos y segundos
  const minutos = Math.floor(segundosTotales / 60);
  const segundos = segundosTotales % 60;
  
  // Formatear con padding de cero para segundos
  return `${minutos}:${segundos.toString().padStart(2, '0')}`;
};

export default function ArmadorPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [proximaActualizacion, setProximaActualizacion] = useState<number | null>(null);
  const [tiempoRestante, setTiempoRestante] = useState<number>(0);
  const [actualizando, setActualizando] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fetch current pedido assigned to armador
  const { data: pedido, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/pedido-para-armador"],
    enabled: !!user,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
  
  // Start pedido mutation
  const startPedidoMutation = useMutation({
    mutationFn: async () => {
      if (!pedido) return null;
      
      try {
        // @ts-ignore - Ignoramos el error de tipo porque sabemos que pedido.id existe
        const res = await apiRequest("POST", `/api/pedidos/${pedido.id}/iniciar`, {});
        
        // Verificar que la respuesta es JSON antes de procesarla
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error(`Error: Respuesta no válida del servidor (${res.status} ${res.statusText})`);
        }
        
        return await res.json();
      } catch (err) {
        console.error("Error al iniciar el pedido:", err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log("Pedido iniciado con éxito, redirigiendo a armado del pedido...");
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      
      // Redirigir al componente de armado-simple con el ID del pedido
      if (pedido && pedido.id) {
        console.log("🚀 Redirigiendo a armado simple del pedido:", pedido.id);
        setLocation(`/armado-simple/${pedido.id}`);
      }
    },
    onError: (error: Error) => {
      console.error("Error en mutación:", error);
      setShowError(true);
      setErrorMessage(error.message || "El pedido ya no está pendiente");
    }
  });
  
  const handleStartArmado = () => {
    // Si el pedido está pausado, mostrar un toast informativo pero permitir continuar
    if (pedidoPausado) {
      toast({
        title: "Pedido pausado",
        description: "El pedido está pausado. Podrás reanudarlo desde la pantalla de armado.",
      });
    }
    startPedidoMutation.mutate();
  };
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Verificar si hay un pedido en proceso
  const [buttonText, setButtonText] = useState("COMENZAR ARMADO");
  const [pedidoPausado, setPedidoPausado] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  
  useEffect(() => {
    // Actualizar texto del botón
    if (pedido) {
      // @ts-ignore - Ignoramos el error de tipo
      if (pedido.estado === 'en-proceso') {
        // @ts-ignore - Verificar si el pedido tiene pausas activas
        if (pedido.pausaActiva) {
          // Si el pedido está pausado, no mostramos el botón CONTINUAR
          setPedidoPausado(true);
          setButtonText("NO DISPONIBLE - PAUSADO");
        } else {
          // Solo se muestra CONTINUAR ARMADO si NO está pausado y no está finalizado
          setPedidoPausado(false);
          setButtonText("CONTINUAR ARMADO");
        }
      } else if (pedido.estado === 'pendiente') {
        // Para pedidos pendientes (no iniciados)
        setPedidoPausado(false);
        setButtonText("COMENZAR ARMADO");
      } else if (pedido.estado === 'armado' || pedido.estado === 'armado-pendiente-stock' || pedido.estado === 'controlado' || pedido.estado === 'finalizado') {
        // Para pedidos ya finalizados o con estado de armado (con o sin pendientes de stock), mostramos mensaje de que no hay pedidos
        // y dejamos que la interfaz lo muestre en el área de "No hay pedidos pendientes"
        console.log("Estado de pedido no procesable: " + pedido.estado);
        // No mostramos este pedido al usuario, en su lugar mostraremos "No hay pedidos pendientes"
        // Esto se maneja en el renderizado (pedido ? ... : ...)
        // @ts-ignore - Hack para la UI, no es una solución ideal pero funciona por ahora
        refetch();
      } else {
        // Para pedidos nuevos
        setPedidoPausado(false);
        setButtonText("COMENZAR ARMADO");
      }
    }
  }, [pedido]);
  
  // Efecto para configurar la recarga automática cada 3 minutos
  useEffect(() => {
    // Limpiar cualquier intervalo existente
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Si no hay pedido y no está cargando, configurar la recarga automática
    if (!isLoading && !pedido) {
      const INTERVALO_RECARGA = 3 * 60 * 1000; // 3 minutos en milisegundos
      const ahora = Date.now();
      const proximoTiempo = ahora + INTERVALO_RECARGA;
      setProximaActualizacion(proximoTiempo);
      setTiempoRestante(INTERVALO_RECARGA);
      
      // Configurar intervalo para actualizar el contador cada segundo
      intervalRef.current = setInterval(() => {
        if (proximaActualizacion) {
          const restante = proximaActualizacion - Date.now();
          setTiempoRestante(Math.max(0, restante));
          
          // Si ha llegado el momento de recargar
          if (restante <= 0) {
            setActualizando(true);
            refetch().finally(() => {
              const nuevoTiempo = Date.now() + INTERVALO_RECARGA;
              setProximaActualizacion(nuevoTiempo);
              setTiempoRestante(INTERVALO_RECARGA);
              setActualizando(false);
            });
          }
        }
      }, 1000);
    }
    
    // Limpieza al desmontar
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLoading, pedido, proximaActualizacion, refetch]);

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
        
        {isLoading ? (
          <p className="text-xl mb-10">Cargando...</p>
        ) : pedido ? (
          <>
            {/* Si el pedido está pausado, mostrar botón CONTINUAR PEDIDO con estilo diferente */}
            {pedidoPausado ? (
              // Botón CONTINUAR PEDIDO para pedidos pausados - con estilo amarillo
              <Button
                onClick={() => {
                  // Ir directamente a la página de armado simple sin reiniciar el pedido
                  if (pedido && pedido.id) {
                    console.log("🚀 Redirigiendo a armado simple del pedido pausado:", pedido.id);
                    setIsNavigating(true);
                    setLocation(`/armado-simple/${pedido.id}`);
                  }
                }}
                className="text-xl px-12 py-6 h-auto rounded-lg mb-4 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={isNavigating}
              >
                CONTINUAR PEDIDO
              </Button>
            ) : (
              // Botón normal para comenzar armado cuando NO está pausado
              <Button
                onClick={handleStartArmado}
                className="text-xl px-12 py-6 h-auto rounded-lg mb-4 bg-white hover:bg-gray-200 text-slate-900"
                disabled={startPedidoMutation.isPending}
              >
                {buttonText}
              </Button>
            )}
            
            {/* Mensaje informativo cuando el pedido está pausado */}
            {pedidoPausado && (
              <div className="text-amber-300 text-sm mb-16 max-w-xs text-center">
                <p>Este pedido está actualmente pausado.</p>
                <p>Debe ser reanudado desde la pantalla de armado.</p>
              </div>
            )}
          </>
        ) : (
          <div className="bg-[#192c52] p-8 rounded-lg mb-16 max-w-md shadow-lg border border-[#2a3e69]">
            <p className="text-xl font-bold mb-2">No hay pedidos pendientes</p>
            <p className="text-white/80 mb-4">No tienes pedidos para armar en este momento.</p>
            
            {/* Contador de próxima actualización */}
            {proximaActualizacion && !actualizando && (
              <div className="mt-4 text-sm text-blue-300">
                <p>Buscando nuevos pedidos automáticamente en:</p>
                <p className="font-mono text-xl mt-1">
                  {formatTiempoRestante(tiempoRestante)}
                </p>
              </div>
            )}
            
            {/* Indicador de actualización en curso */}
            {actualizando && (
              <div className="mt-4 flex items-center justify-center gap-2 text-blue-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Actualizando...</span>
              </div>
            )}
            
            {/* Botón de actualización manual */}
            <Button
              variant="outline"
              className="mt-6 bg-white text-[#192c52] hover:bg-gray-100 border-0 font-medium px-8 py-1"
              onClick={() => {
                setActualizando(true);
                refetch().finally(() => {
                  // Reiniciar el contador para 3 minutos
                  const INTERVALO_RECARGA = 3 * 60 * 1000;
                  const nuevoTiempo = Date.now() + INTERVALO_RECARGA;
                  setProximaActualizacion(nuevoTiempo);
                  setTiempoRestante(INTERVALO_RECARGA);
                  setActualizando(false);
                });
              }}
              disabled={actualizando}
            >
              {actualizando ? "Actualizando..." : "Actualizar ahora"}
            </Button>
          </div>
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
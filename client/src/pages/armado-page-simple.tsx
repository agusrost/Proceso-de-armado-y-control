import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Loader2, ArrowLeft, CheckCircle2, Minus, Plus, Pause, 
  FileText, ClipboardList, X, ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// Interfaz mínima requerida
interface Producto {
  id: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  ubicacion: string;
  recolectado: number | null;
  motivo?: string;
}

export default function ArmadoPageSimple() {
  const { user, logoutMutation: authLogoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [currentProductoIndex, setCurrentProductoIndex] = useState<number>(0);
  const [recolectados, setRecolectados] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  
  // Pedido vacío para evitar problemas de null
  const pedidoVacio = {
    id: 0,
    pedidoId: "Cargando...",
    clienteId: "Cargando...",
    fecha: "",
    items: 0,
    totalProductos: 0,
    vendedor: null,
    estado: "en-proceso",
    puntaje: 0,
    armadorId: null,
    tiempoBruto: null,
    tiempoNeto: null,
    numeroPausas: 0,
    inicio: null,
    finalizado: null,
    rawText: null,
    controladoId: null,
    controlInicio: null,
    controlFin: null,
    controlComentario: null,
    controlTiempo: null,
    pausaActiva: false,
    pausas: []
  };
  
  // Estados para modales
  const [mostrarModalPausa, setMostrarModalPausa] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState("");
  const [motivoPausaDetalle, setMotivoPausaDetalle] = useState("");
  const [mostrarModalVerPedido, setMostrarModalVerPedido] = useState(false);
  const [mostrarModalExito, setMostrarModalExito] = useState(false);
  
  // Opciones de motivos
  const motivosFaltantes = [
    "Faltante de stock",
    "No se encontró el artículo",
    "Producto defectuoso",
    "Otro motivo"
  ];
  
  // Opciones de motivos de pausa
  const motivosPausa = [
    "Motivos sanitarios",
    "Almuerzo",
    "Fin de turno",
    "Otro: especificar"
  ];
  
  // Obtener el pedido actual
  const { data: pedido = pedidoVacio, isLoading } = useQuery({
    queryKey: ["/api/pedido-para-armador"],
    enabled: !!user,
  });
  
  // Obtener productos cuando tenemos el pedido
  useEffect(() => {
    const pedidoId = pedido?.id;
    if (pedidoId && pedidoId > 0) {
      console.log("Cargando productos para pedido:", pedidoId);
      
      // Usar una función async/await para mayor claridad
      const cargarProductos = async () => {
        try {
          const res = await fetch(`/api/productos/pedido/${pedidoId}`);
          if (!res.ok) {
            throw new Error(`Error HTTP: ${res.status}`);
          }
          
          const data = await res.json();
          console.log("Productos cargados:", data);
          
          if (Array.isArray(data)) {
            setProductos(data);
            
            // Seleccionar el primer producto y establecer cantidad inicial
            if (data.length > 0) {
              setCurrentProductoIndex(0);
              setRecolectados(data[0].cantidad);
            }
          } else {
            console.error("Respuesta no es un array:", data);
          }
        } catch (err) {
          console.error("Error al cargar productos:", err);
          toast({
            title: "Error al cargar productos",
            description: "No se pudieron cargar los productos del pedido. Intente de nuevo.",
            variant: "destructive",
          });
        }
      };
      
      cargarProductos();
    }
  }, [pedido, toast]);
  
  // Enviar producto recolectado 
  const actualizarProductoMutation = useMutation({
    mutationFn: async ({ 
      productoId, 
      recolectado, 
      motivo 
    }: { 
      productoId: number; 
      recolectado: number; 
      motivo?: string;
    }) => {
      console.log(`Actualizando producto ${productoId}:`, { recolectado, motivo });
      try {
        const res = await apiRequest("POST", `/api/productos/${productoId}/recolectar`, { 
          recolectado, 
          motivo
        });
        return await res.json();
      } catch (error) {
        console.error("Error en la mutación:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Producto actualizado:", data);
      
      try {
        // Actualizar el producto en la lista
        const nuevosProductos = [...productos];
        
        // Buscar el producto actualizado y modificarlo
        for (let i = 0; i < nuevosProductos.length; i++) {
          if (nuevosProductos[i].id === data.id) {
            nuevosProductos[i] = {
              ...nuevosProductos[i],
              recolectado: data.recolectado,
              motivo: data.motivo
            };
            break;
          }
        }
        
        // Actualizar el estado
        setProductos(nuevosProductos);
        
        // Verificar si todos los productos están recolectados
        let todoCompletado = true;
        for (const p of nuevosProductos) {
          if (p.recolectado === null || p.recolectado <= 0) {
            todoCompletado = false;
            break;
          }
        }
        
        // Si todos están recolectados, mostrar mensaje de éxito
        if (todoCompletado) {
          console.log("¡Todos los productos han sido recolectados!");
          setMostrarModalExito(true);
          return;
        }
        
        // Avanzar al siguiente producto si hay
        if (currentProductoIndex < nuevosProductos.length - 1) {
          try {
            const nextIndex = currentProductoIndex + 1;
            
            // Asegurarnos de que el siguiente índice es válido
            if (nextIndex >= 0 && nextIndex < nuevosProductos.length) {
              const siguienteProducto = nuevosProductos[nextIndex];
              
              if (siguienteProducto) {
                // Actualizar el índice actual
                setCurrentProductoIndex(nextIndex);
                
                // Establecer la cantidad inicial como la cantidad solicitada del producto
                const cantidadInicial = siguienteProducto.cantidad;
                setRecolectados(cantidadInicial);
                setMotivo("");
                
                console.log(`Avanzando al producto ${nextIndex+1} de ${nuevosProductos.length}`);
              }
            }
          } catch (err) {
            console.error("Error al avanzar al siguiente producto:", err);
            toast({
              title: "Error al avanzar",
              description: "Hubo un problema al avanzar al siguiente producto",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Producto guardado",
            description: "Este era el último producto de la lista.",
          });
        }
      } catch (err) {
        console.error("Error en onSuccess:", err);
        toast({
          title: "Error",
          description: "Ocurrió un error inesperado. Por favor, intenta de nuevo.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      console.error("Error al actualizar producto:", error);
      toast({
        title: "Error al actualizar producto",
        description: error.message || "No se pudo actualizar el producto",
        variant: "destructive",
      });
    }
  });
  
  // Finalizar armado del pedido
  const finalizarPedidoMutation = useMutation({
    mutationFn: async (pedidoId: number) => {
      console.log(`Finalizando pedido ${pedidoId}...`);
      const res = await apiRequest("POST", `/api/pedidos/${pedidoId}/finalizar-armado`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Pedido finalizado",
        description: "El pedido ha sido finalizado correctamente."
      });
      setMostrarModalExito(false);
      setLocation('/armador');
    },
    onError: (error: Error) => {
      console.error("Error al finalizar pedido:", error);
      toast({
        title: "Error al finalizar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation para crear pausa
  const crearPausaMutation = useMutation({
    mutationFn: async ({ pedidoId, motivo }: { pedidoId: number, motivo: string }) => {
      console.log(`Creando pausa para pedido ${pedidoId} con motivo: ${motivo}`);
      
      // Determinar el último producto ID
      let ultimoProductoId = null;
      if (currentProductoIndex >= 0 && currentProductoIndex < productos.length) {
        ultimoProductoId = productos[currentProductoIndex].id;
      }
      
      try {
        const res = await apiRequest("POST", `/api/pausas`, {
          pedidoId,
          motivo,
          tipo: "armado",
          ultimoProductoId,
        });
        
        // Verificar el tipo de contenido
        const contentType = res.headers.get("Content-Type");
        if (contentType && contentType.includes("application/json")) {
          return await res.json();
        } else {
          // Si no es JSON, consideramos que la operación fue exitosa
          console.log("Respuesta no JSON recibida del servidor, pero la operación fue exitosa");
          return { success: true };
        }
      } catch (error) {
        console.error("Error en la mutación de pausa:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Armado pausado",
        description: "El armado del pedido ha sido pausado correctamente.",
      });
      
      // Redirigir a la pantalla de armador
      setLocation('/armador');
    },
    onError: (error: Error) => {
      console.error("Error al crear pausa:", error);
      toast({
        title: "Error al pausar armado",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Función simplificada para guardar producto actual
  const handleGuardarYContinuar = () => {
    // Verificamos que exista un producto actual
    if (currentProductoIndex < 0 || currentProductoIndex >= productos.length) {
      toast({
        title: "Error",
        description: "No se pudo identificar el producto actual",
        variant: "destructive",
      });
      return;
    }
    
    const producto = productos[currentProductoIndex];
    if (!producto || !producto.id) {
      toast({
        title: "Error",
        description: "Información de producto incompleta",
        variant: "destructive",
      });
      return;
    }
    
    // Verificamos la cantidad recolectada
    if (recolectados === null) {
      toast({
        title: "Error",
        description: "Debe especificar una cantidad",
        variant: "destructive",
      });
      return;
    }
    
    // Verificamos si necesita motivo por faltante
    const necesitaMotivo = recolectados < producto.cantidad;
    if (necesitaMotivo && !motivo) {
      toast({
        title: "Se requiere motivo",
        description: "Debes seleccionar un motivo para la cantidad faltante.",
        variant: "destructive",
      });
      return;
    }
    
    // Todo verificado, guardamos el producto
    try {
      actualizarProductoMutation.mutate({
        productoId: producto.id,
        recolectado: recolectados,
        motivo: necesitaMotivo ? motivo : undefined
      });
    } catch (err) {
      console.error("Error al guardar producto:", err);
      toast({
        title: "Error al guardar",
        description: "No se pudo guardar el producto. Intente de nuevo.",
        variant: "destructive",
      });
    }
  };
  
  // Finalizar todo el pedido
  const handleFinalizarPedido = () => {
    const pedidoId = pedido?.id;
    if (pedidoId && pedidoId > 0) {
      finalizarPedidoMutation.mutate(pedidoId);
    } else {
      toast({
        title: "Error al finalizar pedido",
        description: "No se pudo identificar el pedido a finalizar.",
        variant: "destructive",
      });
    }
  };
  
  // Manejar la pausa del armado
  const handlePausarArmado = () => {
    const pedidoId = pedido?.id;
    if (!pedidoId || pedidoId <= 0) {
      toast({
        title: "Error al pausar",
        description: "No se pudo identificar el pedido a pausar.",
        variant: "destructive",
      });
      return;
    }
    
    if (motivoPausa === "") {
      toast({
        title: "Selecciona un motivo",
        description: "Debes seleccionar un motivo para pausar el armado.",
        variant: "destructive",
      });
      return;
    }
    
    // Si el motivo es "Otro", debe especificar el detalle
    if (motivoPausa === "Otro: especificar" && motivoPausaDetalle.trim() === "") {
      toast({
        title: "Especifica el motivo",
        description: "Debes especificar el detalle del motivo de pausa.",
        variant: "destructive",
      });
      return;
    }
    
    // Construir el motivo final
    const motivoFinal = motivoPausa === "Otro: especificar" 
      ? motivoPausaDetalle 
      : motivoPausa;
    
    console.log(`Pausando armado del pedido ${pedidoId} con motivo: ${motivoFinal}`);
    crearPausaMutation.mutate({ 
      pedidoId, 
      motivo: motivoFinal 
    });
    
    // Cerrar el modal
    setMostrarModalPausa(false);
  };
  
  // Verificar si un producto está completado
  const esProductoCompletado = (producto: Producto): boolean => {
    return producto.recolectado === producto.cantidad;
  };
  
  // Si no hay usuario o está cargando
  if (!user || isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        <p className="mt-4">Cargando...</p>
      </div>
    );
  }
  
  // Si no hay pedido asignado (sólo para casos excepcionales)
  if (!pedido || pedido.id === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a] text-white p-4">
        <h1 className="text-2xl font-bold mb-4">No hay pedido asignado</h1>
        <p className="mb-6">No tienes un pedido asignado para armar en este momento.</p>
        <Button 
          variant="outline" 
          onClick={() => setLocation('/armador')}
          className="border-white/20 text-white hover:bg-white/10"
        >
          Volver a la pantalla de armador
        </Button>
      </div>
    );
  }
  
  // Si no hay productos
  if (productos.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        <p className="mt-4">Cargando productos...</p>
      </div>
    );
  }
  
  // Pantalla principal de armado
  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] text-white">
      {/* Header */}
      <header className="p-4 bg-blue-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-xl font-bold">Armado de Pedido</h1>
              <p className="text-sm text-white/70">
                {pedido?.pedidoId || 'Cargando...'} - {pedido?.clienteId || 'Cargando...'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="secondary"
              size="sm"
              onClick={() => setMostrarModalVerPedido(true)}
              className="bg-white/10 text-white hover:bg-white/20"
            >
              Ver Pedido
            </Button>
            <Button 
              variant="secondary"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              className="bg-white/10 text-white hover:bg-white/20"
            >
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>
      
      {/* Contenido principal */}
      <div className="flex-grow p-5">
        <div className="max-w-4xl mx-auto">
          
          {/* Producto actual */}
          {productos[currentProductoIndex] && (
            <div className="bg-[#1a2234] rounded-md border border-slate-700 p-5">
              <h3 className="text-xl font-medium mb-4">
                Producto Actual
              </h3>
              
              <div className="mb-5">
                <div className="text-lg font-medium mb-1">{productos[currentProductoIndex].codigo} - {productos[currentProductoIndex].descripcion}</div>
                <div className="text-sm text-white/70">
                  Ubicación: <span className="font-medium">{productos[currentProductoIndex].ubicacion || "N/A"}</span>
                </div>
              </div>
              
              <div className="mb-6">
                <div className="text-sm font-medium mb-2">Cantidad recolectada</div>
                <div className="flex items-center">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => {
                      if (recolectados === null || recolectados <= 0) return;
                      setRecolectados(recolectados - 1);
                    }}
                    disabled={recolectados === null || recolectados <= 0}
                    className="h-10 w-10 rounded-l-md rounded-r-none border-white/20 text-white bg-slate-700"
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                  
                  <Input 
                    type="number"
                    value={recolectados ?? 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 0) {
                        setRecolectados(0);
                      } else if (value > productos[currentProductoIndex].cantidad) {
                        setRecolectados(productos[currentProductoIndex].cantidad);
                      } else {
                        setRecolectados(value);
                      }
                    }}
                    className="w-20 text-center h-10 text-lg rounded-none bg-white text-black"
                  />
                  
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => {
                      if (recolectados === null) {
                        setRecolectados(1);
                        return;
                      }
                      if (recolectados < productos[currentProductoIndex].cantidad) {
                        setRecolectados(recolectados + 1);
                      }
                    }}
                    disabled={recolectados !== null && recolectados >= productos[currentProductoIndex].cantidad}
                    className="h-10 w-10 rounded-r-md rounded-l-none border-white/20 text-white bg-slate-700"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                  
                  <div className="ml-3 text-white/70 flex items-center">
                    <span className="text-sm">de {productos[currentProductoIndex].cantidad}</span>
                  </div>
                </div>
              </div>
              
              {/* Motivo si es necesario */}
              {recolectados !== null && recolectados < productos[currentProductoIndex].cantidad && (
                <div className="mb-6">
                  <Label htmlFor="motivo" className="block text-sm font-medium mb-2">
                    Motivo de faltante <span className="text-red-400">*</span>
                  </Label>
                  <Select 
                    value={motivo} 
                    onValueChange={setMotivo}
                  >
                    <SelectTrigger id="motivo" className="bg-slate-700 border-slate-600">
                      <SelectValue placeholder="Seleccionar motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {motivosFaltantes.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex flex-col items-center space-y-2 mt-8">
                <Button 
                  onClick={handleGuardarYContinuar}
                  disabled={actualizarProductoMutation.isPending}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white py-5 h-14"
                >
                  {actualizarProductoMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : "Continuar"}
                </Button>
                
                <Button 
                  variant="outline"
                  className="w-full text-white bg-transparent border-slate-600 hover:bg-slate-700 py-5 h-14 flex items-center justify-center"
                  onClick={() => setMostrarModalPausa(true)}
                >
                  Pausar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal de pausa */}
      <Dialog open={mostrarModalPausa} onOpenChange={setMostrarModalPausa}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pausar armado</DialogTitle>
            <DialogDescription>
              Selecciona un motivo para pausar el armado de este pedido. Podrás retomarlo más tarde.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="motivo-pausa" className="block text-sm font-medium mb-2">
              Motivo de pausa <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={motivoPausa} 
              onValueChange={setMotivoPausa}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivosPausa.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Detalle para "Otro" */}
            {motivoPausa === "Otro: especificar" && (
              <div className="mt-4">
                <Label htmlFor="motivo-pausa-detalle" className="block text-sm font-medium mb-2">
                  Especificar motivo <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="motivo-pausa-detalle"
                  value={motivoPausaDetalle}
                  onChange={(e) => setMotivoPausaDetalle(e.target.value)}
                  placeholder="Detalla el motivo de la pausa"
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMostrarModalPausa(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handlePausarArmado}
              disabled={crearPausaMutation.isPending}
            >
              {crearPausaMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pausando...
                </>
              ) : "Pausar armado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal de ver pedido completo */}
      <Dialog open={mostrarModalVerPedido} onOpenChange={setMostrarModalVerPedido}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle del Pedido {pedido.pedidoId}</DialogTitle>
            <DialogDescription>
              Detalle completo de todos los productos en este pedido.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[60vh] rounded-md">
            <div className="p-4">
              <div className="space-y-3">
                {productos.map((producto) => (
                  <div 
                    key={producto.id}
                    className={`p-4 rounded-md border ${
                      esProductoCompletado(producto)
                        ? "bg-green-900/20 border-green-500"
                        : producto.recolectado !== null
                          ? "bg-amber-900/20 border-amber-500"
                          : "bg-slate-800 border-slate-600"
                    }`}
                  >
                    <div className="flex justify-between">
                      <div>
                        <div className="font-medium">{producto.codigo} - {producto.descripcion}</div>
                        <div className="text-sm text-white/60 mt-1">
                          Ubicación: {producto.ubicacion || "N/A"} | 
                          Cantidad solicitada: {producto.cantidad}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {producto.recolectado !== null ? (
                          <Badge
                            className={
                              producto.recolectado === producto.cantidad
                                ? "bg-green-500"
                                : "bg-amber-500"
                            }
                          >
                            {producto.recolectado}/{producto.cantidad}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pendiente</Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Mostrar motivo si hay */}
                    {producto.motivo && (
                      <div className="mt-2 text-sm text-amber-400">
                        Motivo: {producto.motivo}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter>
            <Button onClick={() => setMostrarModalVerPedido(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal de éxito al completar */}
      <Dialog open={mostrarModalExito} onOpenChange={setMostrarModalExito}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold">
              ¡Armado completado!
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <p className="text-lg mb-6">
              Ha finalizado el armado del pedido con éxito
            </p>
            
            <Button 
              onClick={handleFinalizarPedido} 
              className="w-full"
              disabled={finalizarPedidoMutation.isPending}
            >
              {finalizarPedidoMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finalizando...
                </>
              ) : "Continuar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Mensaje de confirmación */}
      {actualizarProductoMutation.isSuccess && !mostrarModalExito && (
        <div className="fixed bottom-4 right-4 z-50">
          <Alert className="bg-green-900 border-green-600">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <AlertTitle>Producto guardado</AlertTitle>
            <AlertDescription>
              El producto ha sido actualizado correctamente.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
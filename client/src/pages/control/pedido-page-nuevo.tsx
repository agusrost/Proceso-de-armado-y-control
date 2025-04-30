// Extender Window para depuración
declare global {
  interface Window {
    dataPedido: any;
  }
}

import { useEffect, useState, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useRoute } from "wouter";
import { areCodesEquivalent } from "@/lib/code-utils";
import { 
  ArrowLeft, 
  Barcode, 
  AlertTriangle, 
  StopCircle,
  Eye,
  Loader2,
  CheckCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { Pedido, Producto } from "@shared/schema";
import { ProductoControlado, ControlEstado } from "@shared/types";
import { RetirarExcedenteDialogNuevo } from "@/components/control/retirar-excedente-dialog-nuevo";
import { ProductosEscaneadosLista } from "@/components/control/productos-escaneados-lista";
import { ControlProductoItem } from "@/components/control/control-producto-item";
import { ProductoEscanerSeguro } from "@/components/control/producto-escaner-seguro";

type ControlState = {
  isRunning: boolean;
  startTime: number | null;
  segundos: number;
  productosControlados: ProductoControlado[];
};

export default function ControlPedidoPageNuevo() {
  const [match, params] = useRoute("/control/pedido/:id");
  const pedidoId = match ? parseInt(params.id) : null;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [comentarios, setComentarios] = useState("");
  const [detalleModalOpen, setDetalleModalOpen] = useState(false);
  const [finalizarModalOpen, setFinalizarModalOpen] = useState(false);
  const [cargandoControl, setCargandoControl] = useState(false);
  const [codigoNoEncontradoAlert, setCodigoNoEncontradoAlert] = useState<string | null>(null);
  const [productoConExcedente, setProductoConExcedente] = useState<ProductoControlado | null>(null);
  const [finalizadoDialogOpen, setFinalizadoDialogOpen] = useState(false);
  const [productosFaltantes, setProductosFaltantes] = useState<ProductoControlado[]>([]);
  const [controlFinalizado, setControlFinalizado] = useState<"completo" | "incompleto" | null>(null);
  
  // Estado para bloquear actualizaciones durante la retirada de excedentes
  const [estaRetirandoExcedentes, setEstaRetirandoExcedentes] = useState(false);

  // Estado para el control
  const [controlState, setControlState] = useState<ControlState>({
    isRunning: false,
    startTime: null,
    segundos: 0,
    productosControlados: []
  });

  // Consultas
  const { 
    data: pedido, 
    isLoading: isLoadingPedido 
  } = useQuery({
    queryKey: ["/api/pedidos", pedidoId],
    queryFn: async () => {
      if (!pedidoId) return null;
      const response = await fetch(`/api/pedidos/${pedidoId}`);
      if (!response.ok) {
        throw new Error("Error al cargar el pedido");
      }
      return response.json();
    },
    enabled: !!pedidoId
  });

  const { 
    data: productos, 
    isLoading: isLoadingProductos 
  } = useQuery({
    queryKey: ["/api/pedidos/productos", pedidoId],
    queryFn: async () => {
      if (!pedidoId) return [];
      const response = await fetch(`/api/pedidos/${pedidoId}/productos`);
      if (!response.ok) {
        throw new Error("Error al cargar productos del pedido");
      }
      return response.json();
    },
    enabled: !!pedidoId
  });

  const { 
    data: controlActivo, 
    isLoading: isLoadingControlActivo,
    refetch: refetchControlActivo
  } = useQuery({
    queryKey: ["/api/control/pedidos/activo", pedidoId],
    queryFn: async () => {
      if (!pedidoId) return null;
      const response = await fetch(`/api/control/pedidos/${pedidoId}/activo`);
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No hay control activo, es normal
        }
        throw new Error("Error al verificar control activo");
      }
      return response.json();
    },
    enabled: !!pedidoId,
    refetchInterval: estaRetirandoExcedentes ? false : 5000 // Desactivar el refresco durante retirada de excedentes
  });

  // Iniciar Control
  const iniciarControlMutation = useMutation({
    mutationFn: async () => {
      if (!pedidoId) throw new Error("ID de pedido no válido");
      
      const response = await apiRequest("POST", `/api/control/pedidos/${pedidoId}/iniciar`, {
        comentarios: comentarios || "Control iniciado"
      });
      
      if (!response.ok) {
        throw new Error("Error al iniciar el control");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/pedidos/activo", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos", pedidoId] });
      
      setControlState(prev => ({
        ...prev,
        isRunning: true,
        startTime: Date.now(),
        segundos: 0
      }));
      
      toast({
        title: "Control iniciado",
        description: "El control del pedido ha comenzado",
      });
      
      setCargandoControl(false);
    },
    onError: (error) => {
      console.error("Error al iniciar control:", error);
      toast({
        title: "Error",
        description: "No se pudo iniciar el control del pedido",
        variant: "destructive"
      });
      setCargandoControl(false);
    }
  });

  // Finalizar Control
  const finalizarControlMutation = useMutation({
    mutationFn: async ({ resultado, comentarios }: { resultado: 'completo' | 'incompleto', comentarios?: string }) => {
      if (!pedidoId) throw new Error("ID de pedido no válido");
      
      const response = await apiRequest("POST", `/api/control/pedidos/${pedidoId}/finalizar`, {
        resultado,
        comentarios: comentarios || `Control finalizado: ${resultado}`
      });
      
      if (!response.ok) {
        throw new Error("Error al finalizar el control");
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/pedidos/activo", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos", pedidoId] });
      
      setControlState(prev => ({
        ...prev,
        isRunning: false
      }));

      setControlFinalizado(variables.resultado);
      setFinalizadoDialogOpen(true);
    },
    onError: (error) => {
      console.error("Error al finalizar control:", error);
      toast({
        title: "Error",
        description: "No se pudo finalizar el control del pedido",
        variant: "destructive"
      });
    }
  });

  // Cancelar Control
  const cancelarControlMutation = useMutation({
    mutationFn: async ({ comentarios }: { comentarios?: string }) => {
      if (!pedidoId) throw new Error("ID de pedido no válido");
      
      const response = await apiRequest("POST", `/api/control/pedidos/${pedidoId}/cancelar`, {
        comentarios: comentarios || "Control cancelado por el usuario"
      });
      
      if (!response.ok) {
        throw new Error("Error al cancelar el control");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/pedidos/activo", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos", pedidoId] });
      
      setControlState(prev => ({
        ...prev,
        isRunning: false
      }));
      
      toast({
        title: "Control cancelado",
        description: "El control del pedido ha sido cancelado",
      });

      // Redirigir a la lista de controles
      window.location.href = "/control";
    },
    onError: (error) => {
      console.error("Error al cancelar control:", error);
      toast({
        title: "Error",
        description: "No se pudo cancelar el control del pedido",
        variant: "destructive"
      });
    }
  });

  // Pausar Control
  const pausarControlMutation = useMutation({
    mutationFn: async ({ motivo }: { motivo: string }) => {
      if (!pedidoId) throw new Error("ID de pedido no válido");
      
      const response = await apiRequest("POST", `/api/control/pedidos/${pedidoId}/pausar`, {
        motivo: motivo || "Pausa iniciada por el usuario"
      });
      
      if (!response.ok) {
        throw new Error("Error al pausar el control");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/pedidos/activo", pedidoId] });
      
      toast({
        title: "Control pausado",
        description: "El control del pedido está en pausa",
      });
    },
    onError: (error) => {
      console.error("Error al pausar control:", error);
      toast({
        title: "Error",
        description: "No se pudo pausar el control del pedido",
        variant: "destructive"
      });
    }
  });

  // Escanear Producto
  const escanearProductoMutation = useMutation({
    mutationFn: async ({ codigo, cantidad }: { codigo: string, cantidad: number }) => {
      if (!pedidoId) throw new Error("ID de pedido no válido");
      
      const response = await apiRequest("POST", `/api/control/pedidos/${pedidoId}/escanear`, {
        codigo,
        cantidad
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          setCodigoNoEncontradoAlert(codigo);
          throw new Error("Producto no encontrado en este pedido");
        }
        throw new Error("Error al escanear producto");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Producto escaneado con éxito:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/control/pedidos/activo", pedidoId] });
      
      // Verificar si hay excedentes
      if (data.excessDetected) {
        console.log("¡Excedente detectado!");
        setProductoConExcedente(data.producto);
      } else {
        toast({
          title: "Producto registrado",
          description: `Se ha registrado ${data.cantidadEscaneada} unidades de ${data.codigo}`,
        });
      }
    },
    onError: (error, variables) => {
      // Si no es error de código no encontrado (ese se maneja con el alert específico)
      if (!codigoNoEncontradoAlert) {
        console.error("Error al escanear producto:", error);
        toast({
          title: "Error",
          description: "No se pudo registrar el producto",
          variant: "destructive"
        });
      }
    }
  });

  // Efecto para cargar datos cuando el control ya está activo
  useEffect(() => {
    if (controlActivo?.control && !controlState.isRunning) {
      console.log("Control activo encontrado:", controlActivo);
      
      // Actualizar estado del control
      setControlState(prev => ({
        ...prev,
        isRunning: true,
        startTime: new Date(controlActivo.control.inicio).getTime(),
        segundos: Math.floor((Date.now() - new Date(controlActivo.control.inicio).getTime()) / 1000),
        productosControlados: controlActivo.productosControlados || []
      }));
    }
    
    // Actualizar lista de productos controlados
    if (controlActivo?.productosControlados && controlState.isRunning) {
      setControlState(prev => ({
        ...prev,
        productosControlados: controlActivo.productosControlados
      }));
    }
  }, [controlActivo, controlState.isRunning]);

  // Temporizador
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (controlState.isRunning && controlState.startTime) {
      interval = setInterval(() => {
        setControlState(prev => ({
          ...prev,
          segundos: Math.floor((Date.now() - (prev.startTime || 0)) / 1000)
        }));
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [controlState.isRunning, controlState.startTime]);

  // Iniciar control automáticamente si es continuación
  useEffect(() => {
    // Si tenemos pedido, productos y no está en curso un control
    if (pedido && productos?.length > 0 && !controlState.isRunning && 
        !isLoadingPedido && !isLoadingProductos && !cargandoControl) {
      
      // Verificar si el pedido está en estado de control
      const esEnControl = pedido.estado?.toLowerCase().includes('controlando');
      
      // También iniciar si venimos de la página de controles en curso
      const referer = document.referrer;
      const vieneDePaginaControl = referer.includes('/control') && !referer.includes('/historial');
      
      // Solo iniciar si está en estado de control o viene de la página de controles
      if (esEnControl || vieneDePaginaControl) {
        console.log("Iniciando control automáticamente - condición válida");
        setCargandoControl(true);
        setTimeout(() => {
          iniciarControlMutation.mutate();
        }, 500); // Pequeño retraso para evitar problemas de sincronización
      }
    }
  }, [pedido, productos, controlState.isRunning, isLoadingPedido, isLoadingProductos, cargandoControl]);

  // Exposición de datos para depuración
  useEffect(() => {
    if (pedido && typeof window !== 'undefined') {
      window.dataPedido = {
        pedido,
        productos,
        controlState,
        controlActivo
      };
      console.log("Datos del pedido disponibles en window.dataPedido");
    }
  }, [pedido, productos, controlState, controlActivo]);

  // Función para manejar el escaneo de productos
  const handleEscanearProducto = (codigo: string, cantidad: number) => {
    if (!controlState.isRunning) {
      toast({
        title: "Control no iniciado",
        description: "Debe iniciar el control antes de escanear productos",
        variant: "destructive"
      });
      return;
    }
    
    escanearProductoMutation.mutate({ codigo, cantidad });
  };

  // Función para cerrar el alert de código no encontrado
  const handleCloseCodigoAlert = () => {
    setCodigoNoEncontradoAlert(null);
  };

  // Función para manejar la retirada de excedentes
  const handleConfirmarRetiradaExcedentes = () => {
    setEstaRetirandoExcedentes(false);
    setProductoConExcedente(null);
    
    // Refrescar datos después de retirar excedentes
    setTimeout(() => {
      refetchControlActivo();
    }, 500);
  };

  // Función para mostrar el diálogo de finalización
  const handleMostrarFinalizacion = () => {
    // Verificar si hay productos faltantes
    const faltantes = controlState.productosControlados.filter(p => 
      p.controlado < p.cantidad
    );
    
    if (faltantes.length > 0) {
      setProductosFaltantes(faltantes);
    }
    
    setFinalizarModalOpen(true);
  };

  // Función para confirmar la finalización
  const handleConfirmarFinalizacion = (resultado: 'completo' | 'incompleto') => {
    finalizarControlMutation.mutate({ 
      resultado, 
      comentarios: comentarios || `Control finalizado: ${resultado}` 
    });
    setFinalizarModalOpen(false);
  };

  // Función para cancelar un control
  const handleCancelarControl = () => {
    if (window.confirm("¿Está seguro que desea cancelar este control?")) {
      cancelarControlMutation.mutate({ comentarios });
    }
  };

  // Extraer horas, minutos y segundos del temporizador
  const horas = Math.floor(controlState.segundos / 3600);
  const minutos = Math.floor((controlState.segundos % 3600) / 60);
  const segundos = controlState.segundos % 60;
  
  // Manejar estado de carga
  const isLoading = isLoadingPedido || iniciarControlMutation.isPending || cargandoControl;
  
  // Verificar si todos los productos tienen cantidad exacta
  const todosCantidadCorrecta = controlState.productosControlados.every(p => 
    p.controlado === p.cantidad
  );
  
  // Verificar si hay productos faltantes
  const hasFaltantes = controlState.productosControlados.some(p => 
    p.controlado < p.cantidad
  );

  return (
    <MainLayout>
      <div className="container py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link href="/control">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Control de Pedido</h1>
          </div>
        </div>
        
        {/* Información del pedido */}
        {!isLoading && pedido ? (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Información del Pedido</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDetalleModalOpen(true)}
                    title="Ver detalle completo del pedido"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver detalle
                  </Button>
                  
                  {pedido.estado && (
                    <Badge className={`
                      ${pedido.estado === 'pendiente' ? 'bg-orange-500' : ''}
                      ${pedido.estado === 'armando' ? 'bg-blue-500' : ''}
                      ${pedido.estado === 'finalizado' ? 'bg-green-500' : ''}
                      ${pedido.estado === 'controlando' ? 'bg-purple-500' : ''}
                      ${pedido.estado === 'pre-finalizado' ? 'bg-amber-500' : ''}
                    `}>
                      {pedido.estado.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription>
                Nº {pedido.pedidoId || 'Sin ID'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Cliente</p>
                  <p className="text-md font-medium">{pedido.clienteId || 'No especificado'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha</p>
                  <p className="text-md font-medium">{pedido.fecha || 'No especificada'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vendedor</p>
                  <p className="text-md font-medium">{pedido.vendedor || 'No especificado'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Armador</p>
                  <p className="text-md font-medium">{pedido.armadorId ? `ID: ${pedido.armadorId}` : 'No asignado'}</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Productos: {productos?.length || 0}</span>
                  {controlState.isRunning && (
                    <div className="flex items-center text-sm text-gray-500">
                      <span>Control en curso: {String(horas).padStart(2, '0')}:{String(minutos).padStart(2, '0')}:{String(segundos).padStart(2, '0')}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {controlState.isRunning && (
                    <>
                      <Button 
                        variant="destructive"
                        size="sm" 
                        onClick={handleCancelarControl}
                      >
                        <StopCircle className="h-4 w-4 mr-1" />
                        Cancelar Control
                      </Button>
                      
                      <Button 
                        variant="default"
                        size="sm" 
                        onClick={handleMostrarFinalizacion}
                        disabled={controlState.productosControlados.length === 0}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Finalizar Control
                      </Button>
                    </>
                  )}
                  
                  {!controlState.isRunning && !isLoading && (
                    <Button 
                      variant="default"
                      size="sm" 
                      onClick={() => iniciarControlMutation.mutate()}
                      disabled={iniciarControlMutation.isPending}
                    >
                      {iniciarControlMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Barcode className="h-4 w-4 mr-1" />
                      )}
                      Iniciar Control
                    </Button>
                  )}
                </div>
              </div>
            </CardFooter>
          </Card>
        ) : (
          <Card className="mb-6 p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Cargando información del pedido...</span>
            </div>
          </Card>
        )}
        
        {/* Área principal de control */}
        {!isLoading && controlState.isRunning && (
          <div className="space-y-6">
            {/* Formulario de escaneo */}
            <ProductoEscanerSeguro 
              pedidoId={pedidoId || 0}
              onEscanearSuccess={(data) => {
                // Verificar si hay excedentes
                if (data.excessDetected) {
                  console.log("¡Excedente detectado!");
                  setProductoConExcedente(data.producto);
                } else {
                  toast({
                    title: "Producto registrado",
                    description: `Se ha registrado ${data.cantidadEscaneada} unidades de ${data.codigo}`,
                  });
                }
                
                // Refrescar datos
                refetchControlActivo();
              }}
              onEscanearError={(error) => {
                if (error.message === "Producto no encontrado en este pedido") {
                  setCodigoNoEncontradoAlert(error.codigo || "Desconocido");
                }
              }}
              disabled={!controlState.isRunning || estaRetirandoExcedentes}
            />
            
            {/* Productos del pedido y estado de control */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Productos en el pedido */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Productos en el Pedido</CardTitle>
                  <CardDescription>
                    Lista de productos a controlar ({productos?.length || 0})
                  </CardDescription>
                </CardHeader>
                <CardContent className="max-h-[500px] overflow-y-auto">
                  {productos && productos.length > 0 ? (
                    <div className="space-y-3">
                      {productos.map(producto => {
                        // Buscar si este producto ha sido controlado
                        const productoControlado = controlState.productosControlados.find(
                          p => p.codigo === producto.codigo
                        );
                        
                        // Si ya está controlado, usamos ese objeto que tiene toda la info necesaria
                        if (productoControlado) {
                          return (
                            <ControlProductoItem 
                              key={producto.id || producto.codigo}
                              producto={productoControlado}
                            />
                          );
                        }
                        
                        // Si no está controlado, construimos un objeto equivalente
                        const productoNoControlado: ProductoControlado = {
                          ...producto,
                          controlado: 0,
                          estado: "",
                          imagenUrl: producto.imagenUrl || ""
                        };
                        
                        return (
                          <div 
                            key={producto.id || producto.codigo} 
                            className="p-3 rounded-md border border-gray-300 bg-gray-50"
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{producto.codigo}</span>
                                  <Badge variant="outline">
                                    PENDIENTE
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{producto.descripcion}</p>
                                {producto.ubicacion && (
                                  <p className="text-xs text-gray-500 mt-1">Ubicación: {producto.ubicacion}</p>
                                )}
                              </div>
                              
                              <div className="flex items-center">
                                <div className="text-lg font-bold text-gray-500">
                                  0/{producto.cantidad}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      No hay productos en este pedido
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Productos escaneados */}
              <ProductosEscaneadosLista 
                productos={controlState.productosControlados}
                title="Productos Registrados"
                description="Estado actual de los productos controlados"
                emptyMessage="No se ha registrado ningún producto aún"
              />
            </div>
            
            {/* Comentarios */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Comentarios</CardTitle>
                <CardDescription>
                  Agregue comentarios sobre este control (opcional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Comentarios sobre el control..."
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  className="min-h-[80px]"
                />
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Estado de carga inicial */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span className="text-xl">Cargando...</span>
          </div>
        )}
        
        {/* Sin control activo */}
        {!isLoading && !controlState.isRunning && pedido && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="mb-4">
                <Barcode className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Control de Pedido</h2>
                <p className="text-gray-500 mb-6">
                  Inicie el control para comenzar a escanear los productos del pedido
                </p>
                <Button 
                  onClick={() => iniciarControlMutation.mutate()}
                  disabled={iniciarControlMutation.isPending}
                  size="lg"
                >
                  {iniciarControlMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Barcode className="h-4 w-4 mr-2" />
                  )}
                  Iniciar Control
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Diálogos y Modales */}
      
      {/* Alerta de código no encontrado */}
      {codigoNoEncontradoAlert && (
        <Dialog open={!!codigoNoEncontradoAlert} onOpenChange={() => handleCloseCodigoAlert()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Código no encontrado
              </DialogTitle>
              <DialogDescription>
                El código <strong>{codigoNoEncontradoAlert}</strong> no pertenece a ningún producto de este pedido.
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
              <p>Posibles razones:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                <li>El código escaneado no corresponde a ningún producto del pedido.</li>
                <li>El formato del código es incorrecto.</li>
                <li>El producto no fue incluido en la lista original del pedido.</li>
              </ul>
            </div>
            <DialogFooter>
              <Button onClick={handleCloseCodigoAlert}>
                Entendido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Modal para confirmar retirada de excedentes */}
      {productoConExcedente && (
        <RetirarExcedenteDialogNuevo
          open={!!productoConExcedente}
          onClose={() => setProductoConExcedente(null)}
          onConfirm={handleConfirmarRetiradaExcedentes}
          producto={productoConExcedente}
          pedidoId={pedidoId || 0}
        />
      )}
      
      {/* Modal de finalización de control */}
      {finalizarModalOpen && (
        <Dialog open={finalizarModalOpen} onOpenChange={setFinalizarModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Finalizar Control de Pedido</DialogTitle>
              <DialogDescription>
                {hasFaltantes 
                  ? "El pedido tiene productos con cantidades faltantes." 
                  : "Todos los productos tienen las cantidades correctas."}
              </DialogDescription>
            </DialogHeader>
            
            {hasFaltantes && (
              <div className="space-y-3 my-3">
                <h3 className="font-semibold text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Productos con faltantes:
                </h3>
                
                {productosFaltantes.map((producto, index) => (
                  <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{producto.codigo}</p>
                        <p className="text-sm text-gray-600">{producto.descripcion}</p>
                      </div>
                      <div className="font-bold text-red-600">
                        {producto.controlado}/{producto.cantidad}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <Textarea
              placeholder="Comentarios finales (opcional)"
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              className="min-h-[80px]"
            />
            
            <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
              <Button variant="outline" onClick={() => setFinalizarModalOpen(false)}>
                Cancelar
              </Button>
              
              {hasFaltantes ? (
                <Button 
                  variant="destructive"
                  onClick={() => handleConfirmarFinalizacion('incompleto')}
                >
                  Finalizar con Faltantes
                </Button>
              ) : (
                <Button 
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleConfirmarFinalizacion('completo')}
                >
                  Finalizar Control
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Modal de control finalizado */}
      {finalizadoDialogOpen && (
        <Dialog open={finalizadoDialogOpen} onOpenChange={(isOpen) => {
          if (!isOpen) {
            // Redireccionar a la lista de controles cuando se cierra
            window.location.href = "/control";
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className={controlFinalizado === 'completo' ? 'text-green-600' : 'text-orange-600'}>
                {controlFinalizado === 'completo' 
                  ? "¡Control Completado Exitosamente!" 
                  : "Control Finalizado con Productos Faltantes"}
              </DialogTitle>
              <DialogDescription>
                {controlFinalizado === 'completo' 
                  ? "Todos los productos del pedido han sido controlados correctamente." 
                  : "El control ha sido finalizado pero hay productos con cantidades faltantes."}
              </DialogDescription>
            </DialogHeader>
            
            <div className={`p-4 rounded-md border ${
              controlFinalizado === 'completo' 
                ? 'bg-green-50 border-green-200' 
                : 'bg-orange-50 border-orange-200'
            }`}>
              <div className="flex justify-center items-center mb-4">
                {controlFinalizado === 'completo' 
                  ? <CheckCircle className="h-12 w-12 text-green-600" />
                  : <AlertTriangle className="h-12 w-12 text-orange-600" />
                }
              </div>
              
              <p className="text-center mb-2">
                {controlFinalizado === 'completo' 
                  ? "¡Felicitaciones! Ha controlado el pedido con éxito." 
                  : "El pedido ha sido marcado como controlado con faltantes."}
              </p>
              
              <p className="text-center text-sm text-gray-600">
                Será redirigido a la lista de controles.
              </p>
            </div>
            
            <DialogFooter>
              <Button onClick={() => window.location.href = "/control"}>
                Volver a la Lista
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </MainLayout>
  );
}
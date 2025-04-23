import { useEffect, useState, useRef } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useRoute } from "wouter";
import { 
  ArrowLeft, 
  Timer, 
  Barcode, 
  Plus, 
  Minus, 
  Check, 
  AlertTriangle, 
  StopCircle,
  ClipboardList
} from "lucide-react";
import { formatDate, formatTimestamp } from "@/lib/utils";
import { Pedido, Producto, User } from "@shared/schema";
import { ProductoControlado, ControlState, ControlEstado } from "@shared/types";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlProductoItem } from "@/components/control/control-producto-item";
import { ProductoEscanerForm } from "@/components/control/producto-escaner-form";
import { ControlFinalizarDialog } from "@/components/control/control-finalizar-dialog";
import { CodigoNoEncontradoAlert } from "@/components/control/codigo-no-encontrado-alert";
import { CodigosRegistradosList } from "@/components/control/codigos-registrados-list";

export default function ControlPedidoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [matched, params] = useRoute("/control/pedido/:id");
  const pedidoId = matched && params?.id ? parseInt(params.id) : null;
  
  // Referencias
  const escanerInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para los diálogos
  const [alertOpen, setAlertOpen] = useState(false);
  const [codigoNoEncontrado, setCodigoNoEncontrado] = useState({
    codigo: "",
    descripcion: ""
  });
  
  // Estado del control
  const [controlState, setControlState] = useState<ControlState>({
    isRunning: false,
    startTime: null,
    pedidoId: null,
    codigoPedido: null,
    productosControlados: [],
    historialEscaneos: [],
    segundos: 0
  });
  
  // Dialog de finalización
  const [finalizarOpen, setFinalizarOpen] = useState(false);
  const [comentarios, setComentarios] = useState("");
  
  // Cargar información del pedido
  const { 
    data: pedido, 
    isLoading: isLoadingPedido,
    error: pedidoError
  } = useQuery<Pedido>({
    queryKey: ["/api/pedidos", pedidoId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pedidos/${pedidoId}`);
      return res.json();
    },
    enabled: !!pedidoId,
  });
  
  // Cargar productos del pedido
  const { 
    data: productos = [], 
    isLoading: isLoadingProductos,
    error: productosError
  } = useQuery<Producto[]>({
    queryKey: ["/api/pedidos", pedidoId, "productos"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pedidos/${pedidoId}/productos`);
      return res.json();
    },
    enabled: !!pedidoId,
  });
  
  // Iniciar control mutation
  const iniciarControlMutation = useMutation({
    mutationFn: async () => {
      if (!pedidoId) throw new Error("ID de pedido no válido");
      
      const res = await apiRequest("POST", `/api/control/pedidos/${pedidoId}/iniciar`, {});
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al iniciar control");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Control iniciado",
        description: "El control del pedido ha sido iniciado correctamente",
      });
      
      // Inicializar estado del control
      setControlState({
        isRunning: true,
        startTime: Date.now(),
        pedidoId: pedidoId,
        codigoPedido: data.pedido?.pedidoId || null,
        productosControlados: productos.map(p => ({
          id: p.id,
          codigo: p.codigo,
          cantidad: p.cantidad,
          controlado: 0,
          descripcion: p.descripcion,
          ubicacion: p.ubicacion || "",
          estado: ""
        })),
        historialEscaneos: [],
        segundos: 0
      });
      
      // Actualizar datos del pedido
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos", pedidoId] });
      
      // Focus en el input de escaneo
      setTimeout(() => {
        if (escanerInputRef.current) {
          escanerInputRef.current.focus();
        }
      }, 100);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al iniciar control",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Escanear producto mutation
  const escanearProductoMutation = useMutation({
    mutationFn: async ({ codigo, cantidad }: { codigo: string, cantidad: number }) => {
      if (!pedidoId) throw new Error("ID de pedido no válido");
      
      const res = await apiRequest("POST", `/api/control/pedidos/${pedidoId}/escanear`, {
        codigo,
        cantidad
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al escanear producto");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      // Actualizar estado local
      setControlState(prev => {
        const updatedProductos = prev.productosControlados.map(p => {
          if (p.codigo === data.producto.codigo) {
            return {
              ...p,
              controlado: data.cantidadControlada,
              estado: data.controlEstado
            };
          }
          return p;
        });
        
        // Agregar al historial de escaneos
        const productoEncontrado = prev.productosControlados.find(p => p.codigo === data.producto.codigo);
        
        const nuevoEscaneo = {
          codigo: data.producto.codigo,
          cantidad: data.cantidadControlada,
          descripcion: productoEncontrado?.descripcion || '',
          timestamp: new Date(),
          escaneado: true,
          estado: data.controlEstado
        };
        
        return {
          ...prev,
          productosControlados: updatedProductos,
          historialEscaneos: [...prev.historialEscaneos, nuevoEscaneo]
        };
      });
      
      // Si todos los productos están controlados, sugerir finalizar
      if (data.todosControlados) {
        toast({
          title: "Control completo",
          description: "Todos los productos han sido controlados. Puedes finalizar el control.",
        });
      }
      
      // Focus de nuevo en el input de escaneo
      setTimeout(() => {
        if (escanerInputRef.current) {
          escanerInputRef.current.focus();
        }
      }, 100);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al escanear producto",
        description: error.message,
        variant: "destructive",
      });
      
      // Focus de nuevo en el input de escaneo
      setTimeout(() => {
        if (escanerInputRef.current) {
          escanerInputRef.current.focus();
        }
      }, 100);
    },
  });
  
  // Finalizar control mutation
  const finalizarControlMutation = useMutation({
    mutationFn: async (data: { comentarios: string, resultado: string }) => {
      if (!pedidoId) throw new Error("ID de pedido no válido");
      
      const res = await apiRequest("POST", `/api/control/pedidos/${pedidoId}/finalizar`, data);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al finalizar control");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Control finalizado",
        description: `El control del pedido ha sido finalizado. Tiempo total: ${data.tiempoControl}`,
      });
      
      // Redireccionar al historial
      setLocation("/control/historial");
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar control",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Timer para actualizar el tiempo transcurrido
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (controlState.isRunning && controlState.startTime) {
      intervalId = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - controlState.startTime!) / 1000);
        setControlState(prev => ({
          ...prev,
          segundos: elapsedSeconds
        }));
      }, 1000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [controlState.isRunning, controlState.startTime]);
  
  // Formatear tiempo
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Iniciar el control
  const handleIniciarControl = () => {
    iniciarControlMutation.mutate();
  };
  
  // Abrir diálogo de finalización
  const handleOpenFinalizar = () => {
    setFinalizarOpen(true);
  };
  
  // Finalizar control
  const handleFinalizarControl = (resultado: string) => {
    finalizarControlMutation.mutate({ 
      comentarios, 
      resultado 
    });
    setFinalizarOpen(false);
  };
  
  // Escanear producto
  const handleEscanearProducto = (codigo: string, cantidad: number = 1) => {
    // Imprimir para depuración
    console.log("Escaneando código:", codigo);
    console.log("Productos controlados:", controlState.productosControlados.map(p => p.codigo));
    
    // Verificar si el código pertenece al pedido - usamos includes para manejar strings vs numbers
    const productoEnPedido = controlState.productosControlados.find(p => 
      p.codigo === codigo || p.codigo === String(codigo) || String(p.codigo) === codigo
    );
    
    console.log("¿Producto encontrado?:", !!productoEnPedido);
    
    if (!productoEnPedido) {
      // Mostrar alerta de código no encontrado
      setCodigoNoEncontrado({
        codigo,
        descripcion: "Producto no pertenece a este pedido"
      });
      setAlertOpen(true);
      
      // Agregar al historial de escaneos incluso si no pertenece al pedido
      setControlState(prev => ({
        ...prev,
        historialEscaneos: [
          ...prev.historialEscaneos, 
          {
            codigo,
            cantidad: 0,
            controlado: 0,
            descripcion: "Código no encontrado en este pedido",
            timestamp: new Date(),
            escaneado: false,
            estado: 'excedente'
          }
        ]
      }));
      
      // Focus de nuevo en el input de escaneo después de cerrar la alerta
      setTimeout(() => {
        if (escanerInputRef.current) {
          escanerInputRef.current.focus();
        }
      }, 100);
      
      return;
    }
    
    // Si el código es válido, continuar con el escaneo
    escanearProductoMutation.mutate({ codigo, cantidad });
  };
  
  // Calcular estadísticas
  const totalProductos = controlState.productosControlados.length;
  const productosControlados = controlState.productosControlados.filter(p => p.controlado > 0).length;
  const productosCorrectos = controlState.productosControlados.filter(p => p.estado === 'correcto').length;
  const productosFaltantes = controlState.productosControlados.filter(p => p.estado === 'faltante').length;
  const productosExcedentes = controlState.productosControlados.filter(p => p.estado === 'excedente').length;
  
  // Determinar si todos los productos están controlados
  const todosControlados = totalProductos > 0 && 
    controlState.productosControlados.every(p => p.controlado >= p.cantidad);
  
  // Handler para confirmar un código no encontrado
  const handleConfirmNoEncontrado = () => {
    setAlertOpen(false);
    
    // Focus nuevamente en el input
    setTimeout(() => {
      if (escanerInputRef.current) {
        escanerInputRef.current.focus();
      }
    }, 100);
  };
  
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Button variant="outline" size="icon" asChild className="mr-4">
              <Link to="/control">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold">Control de Pedido</h1>
          </div>
          
          {/* Eliminado el timer según requerimiento */}
        </div>
        
        {/* Alerta de código no encontrado */}
        <CodigoNoEncontradoAlert
          open={alertOpen}
          onOpenChange={setAlertOpen}
          codigo={codigoNoEncontrado.codigo}
          descripcion={codigoNoEncontrado.descripcion}
          onConfirm={handleConfirmNoEncontrado}
        />
        
        {/* Información del Pedido */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Información del Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingPedido ? (
              <div className="text-center">Cargando información del pedido...</div>
            ) : pedidoError ? (
              <div className="text-center text-red-600">
                Error al cargar la información del pedido
              </div>
            ) : pedido ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-neutral-500">ID de Pedido</p>
                  <p className="font-medium">{pedido.pedidoId}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Cliente</p>
                  <p className="font-medium">{pedido.clienteId}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Fecha</p>
                  <p className="font-medium">{formatDate(pedido.fecha)}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Armador</p>
                  <p className="font-medium">
                    {pedido.armadorNombre 
                      ? pedido.armadorNombre 
                      : (pedido.armadorId ? `ID: ${pedido.armadorId}` : "-")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Vendedor</p>
                  <p className="font-medium">{pedido.vendedor || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Productos</p>
                  <p className="font-medium">{pedido.totalProductos}</p>
                </div>
              </div>
            ) : (
              <div className="text-center text-neutral-500">
                Pedido no encontrado
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t pt-4">
            {!controlState.isRunning ? (
              <Button 
                onClick={handleIniciarControl} 
                disabled={iniciarControlMutation.isPending || !pedido || pedido.estado !== 'completado'}
              >
                {iniciarControlMutation.isPending ? "Iniciando..." : "Iniciar Control"}
              </Button>
            ) : (
              <Button 
                variant="destructive" 
                onClick={handleOpenFinalizar}
                disabled={finalizarControlMutation.isPending}
              >
                <StopCircle className="mr-2 h-4 w-4" />
                {finalizarControlMutation.isPending ? "Finalizando..." : "Finalizar Control"}
              </Button>
            )}
          </CardFooter>
        </Card>
        
        {controlState.isRunning && (
          <>
            {/* Escaneo de Productos */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Escaneo de Productos</CardTitle>
                <CardDescription>
                  Escanea el código de barras de cada producto
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProductoEscanerForm 
                  onEscanear={handleEscanearProducto}
                  isLoading={escanearProductoMutation.isPending}
                  inputRef={escanerInputRef}
                />
              </CardContent>
            </Card>
            
            {/* Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <ClipboardList className="h-5 w-5 text-neutral-500" />
                    <span className="text-sm text-neutral-500">Total:</span>
                    <span className="text-xl font-semibold">{totalProductos}</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-neutral-500">Correctos:</span>
                    <span className="text-xl font-semibold">{productosCorrectos}</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Minus className="h-5 w-5 text-red-500" />
                    <span className="text-sm text-neutral-500">Faltantes:</span>
                    <span className="text-xl font-semibold">{productosFaltantes}</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Plus className="h-5 w-5 text-amber-500" />
                    <span className="text-sm text-neutral-500">Excedentes:</span>
                    <span className="text-xl font-semibold">{productosExcedentes}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Listado de Productos */}
            <Card>
              <CardHeader>
                <CardTitle>Productos del Pedido</CardTitle>
                <CardDescription>
                  Listado de productos y su estado de control
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="todos" className="mb-4">
                  <TabsList>
                    <TabsTrigger value="todos">Todos ({totalProductos})</TabsTrigger>
                    <TabsTrigger value="correctos">Correctos ({productosCorrectos})</TabsTrigger>
                    <TabsTrigger value="faltantes">Faltantes ({productosFaltantes})</TabsTrigger>
                    <TabsTrigger value="excedentes">Excedentes ({productosExcedentes})</TabsTrigger>
                    <TabsTrigger value="pendientes">Pendientes ({totalProductos - productosControlados})</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="todos" className="pt-4">
                    {controlState.productosControlados.length === 0 ? (
                      <div className="text-center py-4 text-neutral-500">
                        No hay productos en este pedido
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {controlState.productosControlados.map(producto => (
                          <ControlProductoItem 
                            key={producto.id} 
                            producto={producto} 
                            onEscanear={(cantidad) => handleEscanearProducto(producto.codigo, cantidad)}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="correctos" className="pt-4">
                    {controlState.productosControlados.filter(p => p.estado === 'correcto').length === 0 ? (
                      <div className="text-center py-4 text-neutral-500">
                        No hay productos correctos
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {controlState.productosControlados
                          .filter(p => p.estado === 'correcto')
                          .map(producto => (
                            <ControlProductoItem 
                              key={producto.id} 
                              producto={producto} 
                              onEscanear={(cantidad) => handleEscanearProducto(producto.codigo, cantidad)}
                            />
                          ))
                        }
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="faltantes" className="pt-4">
                    {controlState.productosControlados.filter(p => p.estado === 'faltante').length === 0 ? (
                      <div className="text-center py-4 text-neutral-500">
                        No hay productos faltantes
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {controlState.productosControlados
                          .filter(p => p.estado === 'faltante')
                          .map(producto => (
                            <ControlProductoItem 
                              key={producto.id} 
                              producto={producto} 
                              onEscanear={(cantidad) => handleEscanearProducto(producto.codigo, cantidad)}
                            />
                          ))
                        }
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="excedentes" className="pt-4">
                    {controlState.productosControlados.filter(p => p.estado === 'excedente').length === 0 ? (
                      <div className="text-center py-4 text-neutral-500">
                        No hay productos excedentes
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {controlState.productosControlados
                          .filter(p => p.estado === 'excedente')
                          .map(producto => (
                            <ControlProductoItem 
                              key={producto.id} 
                              producto={producto} 
                              onEscanear={(cantidad) => handleEscanearProducto(producto.codigo, cantidad)}
                            />
                          ))
                        }
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="pendientes" className="pt-4">
                    {controlState.productosControlados.filter(p => p.controlado === 0).length === 0 ? (
                      <div className="text-center py-4 text-neutral-500">
                        No hay productos pendientes
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {controlState.productosControlados
                          .filter(p => p.controlado === 0)
                          .map(producto => (
                            <ControlProductoItem 
                              key={producto.id} 
                              producto={producto} 
                              onEscanear={(cantidad) => handleEscanearProducto(producto.codigo, cantidad)}
                            />
                          ))
                        }
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
        
        {/* Diálogo de finalización */}
        <ControlFinalizarDialog 
          open={finalizarOpen} 
          onOpenChange={setFinalizarOpen}
          onFinalizar={handleFinalizarControl}
          comentarios={comentarios}
          onComentariosChange={setComentarios}
          hasFaltantes={productosFaltantes > 0}
          hasExcedentes={productosExcedentes > 0}
        />
        
        {/* Códigos Registrados */}
        {controlState.isRunning && controlState.historialEscaneos?.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Códigos Registrados</CardTitle>
              <CardDescription>
                Historial de todos los códigos escaneados durante este control
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodigosRegistradosList productos={controlState.historialEscaneos} />
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
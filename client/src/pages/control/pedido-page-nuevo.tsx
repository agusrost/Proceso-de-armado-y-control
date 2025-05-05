import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ProductoControlado, ControlState } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Info as InfoIcon,
  ArrowLeft,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Package as Packages,
  PackageCheck,
  AlertTriangle,
  PauseCircle,
  PlayCircle
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductoEscanerSeguro } from '@/components/control/producto-escaner-seguro';
import { ProductosEscaneadosLista } from '@/components/control/productos-escaneados-lista';

export default function ControlPedidoPageNuevo() {
  const { id } = useParams<{ id: string }>();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const pedidoId = parseInt(id);
  
  // Estado local
  const [controlState, setControlState] = useState<ControlState>({
    isRunning: false,
    startTime: null,
    pedidoId: null,
    codigoPedido: null,
    productosControlados: [],
    historialEscaneos: [],
    segundos: 0,
    pedidoYaControlado: false,
    mensajeError: null
  });
  
  // Funcion para iniciar control manualmente
  const iniciarControlManualmente = async () => {
    console.log("Intentando iniciar un nuevo control...");
    try {
      const initResp = await fetch(`/api/control/pedidos/${pedidoId}/iniciar`, {
        method: 'POST'
      });
      
      if (initResp.ok) {
        toast({
          title: "Control iniciado",
          description: "Se ha iniciado un nuevo control para este pedido",
          variant: "default"
        });
        // Recargar la página para mostrar el nuevo control
        window.location.reload();
      } else {
        // Intentar obtener el mensaje de error
        try {
          const errorData = await initResp.json();
          toast({
            title: "No se pudo iniciar el control",
            description: errorData.message || errorData.error || "Error al iniciar el control",
            variant: "destructive",
            duration: 6000
          });
        } catch (e) {
          toast({
            title: "No se pudo iniciar el control",
            description: `Error: ${initResp.status}`,
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error("Error al iniciar control:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al intentar iniciar el control",
        variant: "destructive"
      });
    }
  };
  
  // Manejar errores de forma más robusta
  useEffect(() => {
    const handleError = async () => {
      try {
        // Si hay un error de control, intentar reiniciar el control
        if (controlState.mensajeError === "No se pudo cargar la información del control") {
          console.log("Intentando reiniciar el control...");
          const resp = await fetch(`/api/control/pedidos/${pedidoId}/activo`);
          
          // Verificar si hay un error relacionado con el estado
          if (resp.status === 400) {
            try {
              const errorData = await resp.json();
              
              // Verificar si es un error de estado incompatible
              if (errorData.error === 'ESTADO_INCOMPATIBLE') {
                console.log("Estado incompatible:", errorData.message);
                toast({
                  title: "Estado del pedido incompatible",
                  description: errorData.message,
                  variant: "destructive",
                  duration: 6000
                });
                // Mostrar mensaje y ofrecer iniciar el control
                const confirmIniciar = window.confirm(`El pedido no está listo para control: ${errorData.message}\n\n¿Desea intentar iniciar el control de todos modos?`);
                
                if (confirmIniciar) {
                  iniciarControlManualmente();
                } else {
                  // Volver a la lista de control
                  navigate('/control');
                }
                return;
              }
            } catch (parseError) {
              console.error("Error al procesar respuesta de error:", parseError);
            }
          }
          
          if (resp.status === 404) {
            // Intentar iniciar un nuevo control automáticamente
            iniciarControlManualmente();
          }
        }
      } catch (error) {
        console.error("Error al intentar reiniciar el control:", error);
      }
    };
    
    if (controlState.mensajeError) {
      handleError();
    }
  }, [controlState.mensajeError, pedidoId, toast, navigate]);
  
  // Estado para diálogos y control
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [finalizandoControl, setFinalizandoControl] = useState(false);
  const [tabActiva, setTabActiva] = useState("productos");
  const [pausando, setPausando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState("");
  const [showPausaDialog, setShowPausaDialog] = useState(false);
  
  // Opciones de motivos de pausa (igual que en la interfaz de armado)
  const motivosPausa = [
    "Motivos sanitarios",
    "Almuerzo",
    "Fin de turno",
    "Otro: especificar"
  ];

  // Obtener información de control activo para este pedido
  const { 
    data: controlData, 
    isLoading: isLoadingControl,
    error: controlError,
    refetch: refetchControl
  } = useQuery({
    queryKey: [`/api/control/pedidos/${pedidoId}/activo`],
    refetchInterval: 5000, // Recargar cada 5 segundos
    // Función personalizada para manejar errores 404 - caso especial
    queryFn: async () => {
      try {
        const response = await fetch(`/api/control/pedidos/${pedidoId}/activo`);
        
        // Si hay error 400, podría ser un problema de estado incompatible
        if (response.status === 400) {
          try {
            const errorData = await response.json();
            
            // Si es un error de estado incompatible, manejar específicamente
            if (errorData.error === 'ESTADO_INCOMPATIBLE') {
              console.log("Estado incompatible en queryFn:", errorData.message);
              
              // Mostrar diálogo de confirmación
              setTimeout(() => {
                const confirmIniciar = window.confirm(
                  `El pedido no está listo para control: ${errorData.message}\n\n¿Desea intentar iniciar el control automáticamente?`
                );
                
                if (confirmIniciar) {
                  // Intentará iniciar el control en useEffect al detectar el error
                  console.log("Usuario confirmó iniciar control manualmente");
                } else {
                  // Volver a la lista de control si el usuario cancela
                  navigate('/control');
                }
              }, 100);
            }
          } catch (parseError) {
            console.error("Error al procesar respuesta de error:", parseError);
          }
          
          // Seguimos lanzando el error para que entre el mecanismo de manejo en useEffect
          throw new Error('No se pudo cargar la información del control');
        }
        
        // Si el pedido está controlado, mostrar mensaje de éxito en lugar de error
        if (response.status === 404) {
          // Verificar si el pedido ya está en estado controlado
          const pedidoResponse = await fetch(`/api/pedidos/${pedidoId}`);
          if (pedidoResponse.ok) {
            const pedidoData = await pedidoResponse.json();
            
            if (pedidoData.estado === 'controlado') {
              // Retornar un objeto con información sobre el pedido controlado
              // en vez de lanzar un error
              return {
                pedidoControlado: true,
                pedido: pedidoData,
                mensaje: '¡Control completado con éxito!'
              };
            }
          }
        }
        
        if (!response.ok) {
          throw new Error('No se pudo cargar la información del control');
        }
        
        return response.json();
      } catch (error) {
        console.error('Error al cargar el control:', error);
        throw error;
      }
    }
  });
  
  // Estado para diálogo de finalización exitosa
  const [showExitoDialog, setShowExitoDialog] = useState(false);

  // Mutación para pausar/reanudar control
  const pausarControlMutation = useMutation({
    mutationFn: async (motivoSeleccionado?: string) => {
      setPausando(true);
      const endpoint = pausado 
        ? `/api/control/pedidos/${pedidoId}/reanudar` 
        : `/api/control/pedidos/${pedidoId}/pausar`;
      
      const body = pausado ? {} : { motivo: motivoSeleccionado };
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error al ${pausado ? 'reanudar' : 'pausar'} el control`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Actualizar estado local
      setPausado(!pausado);
      setShowPausaDialog(false);
      setMotivoPausa("");
      
      // Mostrar confirmación
      toast({
        title: pausado ? 'Control reanudado' : 'Control pausado',
        description: pausado 
          ? 'El tiempo de control está corriendo nuevamente.' 
          : 'El tiempo de control ha sido pausado.',
      });
      
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({
        queryKey: [`/api/control/pedidos/${pedidoId}/activo`],
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || `No se pudo ${pausado ? 'reanudar' : 'pausar'} el control`,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setPausando(false);
    }
  });

  // Manejar pausar/reanudar control
  const handlePausarReanudar = () => {
    if (pausado) {
      // Si está pausado, solo reanudar (no necesita motivo)
      pausarControlMutation.mutate(undefined);
    } else {
      // Si está activo, mostrar diálogo para seleccionar motivo de pausa
      setShowPausaDialog(true);
    }
  };
  
  // Confirmar pausa con motivo seleccionado
  const confirmarPausa = () => {
    if (motivoPausa) {
      pausarControlMutation.mutate(motivoPausa);
    } else {
      toast({
        title: 'Error',
        description: 'Debe seleccionar un motivo para pausar el control',
        variant: 'destructive',
      });
    }
  };

  // Manejar mutación para finalizar control
  const finalizarControlMutation = useMutation({
    mutationFn: async () => {
      setFinalizandoControl(true);
      const response = await fetch(`/api/control/pedidos/${pedidoId}/finalizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al finalizar el control');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({
        queryKey: [`/api/control/pedidos/${pedidoId}/activo`],
      });
      
      // Mostrar diálogo de éxito centralizado
      setShowExitoDialog(true);
    },
    onError: (error: Error) => {
      setFinalizandoControl(false);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo finalizar el control',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setShowFinalizarDialog(false);
    }
  });

  // Función para actualizar un producto específico
  const handleProductoUpdate = (productoActualizado: ProductoControlado) => {
    // Actualizar estado con el nuevo producto
    setControlState(prevState => {
      const nuevosProductos = prevState.productosControlados.map(p => 
        p.codigo === productoActualizado.codigo ? productoActualizado : p
      );
      
      return {
        ...prevState,
        productosControlados: nuevosProductos
      };
    });
    
    // Actualizar en el backend
    fetch(`/api/control/productos/${productoActualizado.codigo}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pedidoId: pedidoId,
        controlado: productoActualizado.controlado,
        estado: productoActualizado.estado
      })
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.message || 'Error al actualizar producto');
        });
      }
      return response.json();
    })
    .then(data => {
      refetchControl(); // Refrescar datos
      
      toast({
        title: 'Producto actualizado',
        description: `Se ha actualizado la cantidad de ${productoActualizado.codigo} a ${productoActualizado.controlado}`,
      });
    })
    .catch(error => {
      console.error('Error al actualizar producto:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el producto',
        variant: 'destructive',
      });
    });
  };

  // Procesar productos controlados a partir de los datos
  const procesarProductosControlados = (data: any): ProductoControlado[] => {
    if (!data || !data.detalles || !data.productos) {
      return [];
    }
    
    // Crear mapa para contar la cantidad controlada por código
    const cantidadesControladas = new Map<string, number>();
    
    // Sumar cantidades de los detalles
    data.detalles.forEach((detalle: any) => {
      const codigo = detalle.codigo;
      const cantidadActual = cantidadesControladas.get(codigo) || 0;
      cantidadesControladas.set(codigo, cantidadActual + (detalle.cantidadControlada || 0));
    });
    
    // Crear productos controlados
    return data.productos.map((producto: any) => {
      const cantidadControlada = cantidadesControladas.get(producto.codigo) || 0;
      let estado: 'faltante' | 'correcto' | 'excedente' | '' = '';
      
      if (cantidadControlada < producto.cantidad) {
        estado = 'faltante';
      } else if (cantidadControlada > producto.cantidad) {
        estado = 'excedente';
      } else {
        estado = 'correcto';
      }
      
      return {
        id: producto.id,
        codigo: producto.codigo,
        cantidad: producto.cantidad,
        controlado: cantidadControlada,
        descripcion: producto.descripcion,
        ubicacion: producto.ubicacion,
        estado
      };
    });
  };

  // Procesar datos del control cuando se cargan
  useEffect(() => {
    if (controlData && !isLoadingControl) {
      // Actualizar estado con los datos del control
      setControlState(prevState => ({
        ...prevState,
        isRunning: controlData.control?.estado === 'activo',
        pedidoId: controlData.pedido?.id || null,
        codigoPedido: controlData.pedido?.pedidoId || null,
        productosControlados: procesarProductosControlados(controlData),
        pedidoYaControlado: controlData.control?.estado === 'completado'
      }));
    }
  }, [controlData, isLoadingControl]);

  // Manejar escaneo exitoso
  const handleEscanearSuccess = (data: any) => {
    // Refrescar datos del control
    refetchControl();
    
    // Verificar si el control se finalizó automáticamente
    if (data?.finalizadoAutomaticamente) {
      // Mostrar un mensaje más significativo
      toast({
        title: 'Control finalizado automáticamente',
        description: 'Todos los productos han sido controlados correctamente.',
        variant: 'default',
      });
      
      // Mostrar el diálogo de éxito
      setShowExitoDialog(true);
      return;
    }
    
    // Obtener información del producto para mostrar en la notificación
    const codigo = data?.codigo || data?.productoData?.codigo || 'Producto';
    const cantidad = data?.cantidadControlada || data?.cantidad || 1;
    
    // Mostrar confirmación estándar para escaneo normal
    toast({
      title: 'Producto escaneado',
      description: `${codigo}: ${cantidad} unidad(es)`,
    });
    
    // Ya no cambiamos de pestaña para permitir escaneos consecutivos
    // setTabActiva("productos");
  };

  // Manejar error en escaneo
  const handleEscanearError = (error: any) => {
    if (error.message === "Producto no encontrado en este pedido") {
      toast({
        title: 'Producto no válido',
        description: 'Este producto no pertenece a este pedido',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Error',
        description: error.message || 'Error al escanear producto',
        variant: 'destructive',
      });
    }
  };

  // Calcular estadísticas para mostrar en UI
  const totalProductos = controlState.productosControlados.length;
  const productosCompletos = controlState.productosControlados.filter(p => 
    p.controlado === p.cantidad
  ).length;
  
  const productosExcedentes = controlState.productosControlados.filter(p => 
    p.controlado > p.cantidad
  ).length;
  
  const productosFaltantes = controlState.productosControlados.filter(p => 
    p.controlado < p.cantidad
  ).length;
  
  const hayExcedentes = productosExcedentes > 0;
  const hayFaltantes = productosFaltantes > 0;
  
  // Calcular estado de completitud
  const porcentajeCompletado = totalProductos > 0 
    ? Math.round((productosCompletos / totalProductos) * 100) 
    : 0;

  // Si hay error de carga o el pedido está ya controlado, mostrar pantalla alternativa
  if (controlError || (controlData?.pedidoControlado)) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col space-y-6">
          <div className="flex items-center mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="mr-2"
              onClick={() => navigate('/control')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver
            </Button>
            <h1 className="text-2xl font-bold">Control de Pedido #{id}</h1>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-8">
                {controlData?.pedidoControlado ? (
                  <>
                    <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-center mb-2">
                      Pedido ya controlado
                    </h2>
                    <p className="text-center text-gray-600 mb-6">
                      Este pedido ya ha sido verificado y está marcado como controlado.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                      <InfoIcon className="h-10 w-10 text-amber-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-center mb-2">
                      No hay un control activo
                    </h2>
                    <p className="text-center text-gray-600 mb-6">
                      No se encontró un control activo para este pedido.
                    </p>
                  </>
                )}
                <Button 
                  onClick={() => navigate('/control')}
                  className="w-full max-w-xs"
                >
                  Volver a la lista de pedidos
                </Button>
                {!controlData?.pedidoControlado && (
                  <Button 
                    onClick={iniciarControlManualmente}
                    variant="outline"
                    className="w-full max-w-xs mt-2"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Iniciar control manual
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Si está cargando, mostrar spinner
  if (isLoadingControl) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="flex flex-col items-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <h2 className="text-xl font-medium">Cargando información del control...</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col space-y-6">
        {/* Encabezado y acciones */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center">
            <Button 
              variant="outline" 
              size="sm" 
              className="mr-2"
              onClick={() => navigate('/control')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Control #{controlData?.control?.id}</h1>
              <p className="text-gray-500">
                Pedido: {controlData?.pedido?.pedidoId} - Cliente: {controlData?.pedido?.clienteId}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant={pausado ? "default" : "outline"}
              onClick={handlePausarReanudar}
              className={pausado ? "bg-green-600 hover:bg-green-700" : "border-orange-200 text-orange-700 hover:bg-orange-50"}
              disabled={controlState.productosControlados.length === 0}
            >
              {pausado ? (
                <>
                  <PlayCircle className="h-4 w-4 mr-1" />
                  Continuar control
                </>
              ) : (
                <>
                  <PauseCircle className="h-4 w-4 mr-1" />
                  Pausar control
                </>
              )}
            </Button>
            
            <Button 
              variant={hayFaltantes ? "outline" : "default"}
              className={hayFaltantes ? "border-red-200 text-red-700 hover:bg-red-50" : ""}
              onClick={() => setShowFinalizarDialog(true)}
              disabled={controlState.productosControlados.length === 0}
            >
              <PackageCheck className="h-4 w-4 mr-1" />
              Finalizar control
            </Button>
          </div>
        </div>
        
        {/* Contenido principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel izquierdo - Escaneo */}
          <div className="lg:col-span-2">
            <Tabs value={tabActiva} onValueChange={setTabActiva}>
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="productos">
                  <Packages className="h-4 w-4 mr-1" />
                  Productos
                </TabsTrigger>
                <TabsTrigger value="escanear">
                  <PackageCheck className="h-4 w-4 mr-1" />
                  Escanear
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="productos" className="space-y-4">
                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-xl flex items-center">
                      <Packages className="h-5 w-5 mr-2" />
                      Estado del control
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Mostrar cuando no hay productos aún */}
                    {controlState.productosControlados.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500 mb-4">No hay productos controlados aún</p>
                        <Button 
                          variant="secondary" 
                          onClick={() => setTabActiva("escanear")}
                        >
                          Empezar a escanear
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Resumen de progreso */}
                        <div className="flex flex-col space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Progreso</span>
                            <span className="text-sm text-gray-500">{porcentajeCompletado}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full ${
                                porcentajeCompletado === 100 
                                  ? "bg-green-600" 
                                  : hayFaltantes 
                                    ? "bg-yellow-400"
                                    : "bg-blue-600"
                              }`}
                              style={{ width: `${porcentajeCompletado}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-sm text-gray-500 mt-1">
                            <span>{productosCompletos} de {totalProductos} productos completos</span>
                            {hayFaltantes && (
                              <span className="text-yellow-600 font-medium">{productosFaltantes} faltantes</span>
                            )}
                            {hayExcedentes && (
                              <span className="text-red-600 font-medium">{productosExcedentes} excedentes</span>
                            )}
                          </div>
                        </div>
                        
                        <Separator />
                        
                        {/* Productos con excedentes */}
                        {hayExcedentes && (
                          <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-3 flex items-center text-red-700">
                              <XCircle className="h-5 w-5 mr-2 text-red-600" />
                              Productos con excedentes
                            </h3>
                            <div className="space-y-3">
                              {controlState.productosControlados
                                .filter(p => p.controlado > p.cantidad)
                                .map(producto => (
                                  <div 
                                    key={producto.codigo}
                                    className="p-3 border border-red-200 rounded-md bg-red-50 flex justify-between items-center hover:bg-red-100 cursor-pointer transition-colors"
                                    onClick={() => {
                                      // Si hay excedente, actualizamos el producto para igualarlo a la cantidad correcta
                                      if (producto.controlado > producto.cantidad) {
                                        handleProductoUpdate({
                                          ...producto,
                                          controlado: producto.cantidad,
                                          estado: 'correcto'
                                        });
                                      }
                                    }}
                                  >
                                    <div>
                                      <div className="font-medium">{producto.codigo}</div>
                                      <div className="text-sm text-gray-600">{producto.descripcion}</div>
                                    </div>
                                    <div className="text-red-700 font-bold text-lg">
                                      {producto.controlado}/{producto.cantidad}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Productos con faltantes */}
                        {hayFaltantes && (
                          <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-3 flex items-center text-yellow-700">
                              <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
                              Productos con faltantes
                            </h3>
                            <div className="space-y-3">
                              {controlState.productosControlados
                                .filter(p => p.controlado < p.cantidad)
                                .map(producto => (
                                  <div 
                                    key={producto.codigo}
                                    className="p-3 border border-yellow-200 rounded-md bg-yellow-50 flex justify-between items-center"
                                  >
                                    <div>
                                      <div className="font-medium">{producto.codigo}</div>
                                      <div className="text-sm text-gray-600">{producto.descripcion}</div>
                                    </div>
                                    <div className="text-yellow-700 font-bold text-lg">
                                      {producto.controlado}/{producto.cantidad}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Productos completos */}
                        {productosCompletos > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold mb-3 flex items-center text-green-700">
                              <CheckCircle2 className="h-5 w-5 mr-2 text-green-600" />
                              Productos completos
                            </h3>
                            <div className="space-y-3">
                              {controlState.productosControlados
                                .filter(p => p.controlado >= p.cantidad)
                                .map(producto => (
                                  <div 
                                    key={producto.codigo}
                                    className="p-3 border border-green-200 rounded-md bg-green-50 flex justify-between items-center"
                                  >
                                    <div>
                                      <div className="font-medium">{producto.codigo}</div>
                                      <div className="text-sm text-gray-600">{producto.descripcion}</div>
                                    </div>
                                    <div className="text-green-700 font-bold text-lg">
                                      {producto.controlado}/{producto.cantidad}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="escanear" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <ProductoEscanerSeguro 
                      onEscaneo={async (codigo) => {
                        try {
                          const response = await fetch(`/api/control/pedidos/${pedidoId}/escanear`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ codigo }),
                          });
                          
                          if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || 'Error al escanear producto');
                          }
                          
                          const data = await response.json();
                          handleEscanearSuccess(data);
                        } catch (error) {
                          console.error('Error al escanear:', error);
                          handleEscanearError(error);
                        }
                      }}
                      allowOverflow={true}
                      buttonText="Escanear producto"
                      showEscanerAutomatico={true}
                    />
                    
                    <div className="mt-6">
                      <h3 className="font-medium mb-4">Productos escaneados</h3>
                      <ProductosEscaneadosLista 
                        productos={controlState.productosControlados}
                        onProductoUpdate={handleProductoUpdate}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Panel derecho - Información del pedido */}
          <div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">Información del pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-1">
                    <div className="text-sm font-medium">Código</div>
                    <div className="text-sm">{controlData?.pedido?.pedidoId}</div>
                    
                    <div className="text-sm font-medium">Cliente</div>
                    <div className="text-sm">{controlData?.pedido?.clienteId}</div>
                    
                    <div className="text-sm font-medium">Estado</div>
                    <div className="text-sm capitalize">{controlData?.pedido?.estado}</div>
                    
                    <div className="text-sm font-medium">Productos</div>
                    <div className="text-sm">{controlData?.pedido?.totalProductos}</div>
                    
                    <div className="text-sm font-medium">Armado por</div>
                    <div className="text-sm">{controlData?.pedido?.armador?.firstName} {controlData?.pedido?.armador?.lastName}</div>
                    
                    <div className="text-sm font-medium">Vendedor</div>
                    <div className="text-sm">{controlData?.pedido?.vendedor || '-'}</div>
                    
                    <div className="text-sm font-medium">Fecha</div>
                    <div className="text-sm">{new Date(controlData?.pedido?.fecha).toLocaleDateString()}</div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-medium mb-2">Estado del control</h3>
                    <div className="grid grid-cols-2 gap-1">
                      <div className="text-sm font-medium">Control #</div>
                      <div className="text-sm">{controlData?.control?.id}</div>
                      
                      <div className="text-sm font-medium">Iniciado</div>
                      <div className="text-sm">
                        {controlData?.control?.inicio 
                          ? new Date(controlData.control.inicio).toLocaleString()
                          : '-'
                        }
                      </div>
                      
                      <div className="text-sm font-medium">Tiempo activo</div>
                      <div className="text-sm">
                        {controlData?.tiempo || '-'}
                      </div>
                      
                      <div className="text-sm font-medium">Estado</div>
                      <div className="text-sm capitalize">
                        {pausado ? (
                          <span className="text-orange-600 font-medium">Pausado</span>
                        ) : (
                          <span className="text-green-600 font-medium">Activo</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {controlData?.pausas && controlData.pausas.length > 0 && (
                    <>
                      <Separator />
                      
                      <div>
                        <h3 className="font-medium mb-2">Pausas realizadas</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                          {controlData.pausas.map((pausa: any, index: number) => (
                            <div 
                              key={index} 
                              className="p-2 border rounded-md text-sm flex justify-between items-center"
                            >
                              <div>
                                <div>{pausa.motivo}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(pausa.inicio).toLocaleString()}
                                  {pausa.fin && ` → ${new Date(pausa.fin).toLocaleString()}`}
                                </div>
                              </div>
                              <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                                pausa.fin 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {pausa.fin ? 'Completada' : 'Activa'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Diálogo de confirmación */}
      <AlertDialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar finalización</AlertDialogTitle>
            <AlertDialogDescription>
              {hayFaltantes 
                ? "El pedido tiene productos con cantidades faltantes. ¿Está seguro de que desea finalizar el control?"
                : "¿Está seguro de que desea finalizar el control de este pedido?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizandoControl}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                finalizarControlMutation.mutate();
              }}
              disabled={finalizandoControl}
              className={hayFaltantes ? "bg-yellow-600 hover:bg-yellow-700" : ""}
            >
              {finalizandoControl ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  {hayFaltantes ? "Finalizar con faltantes" : "Finalizar control"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Diálogo de finalización exitosa */}
      <Dialog open={showExitoDialog} onOpenChange={(open) => !open && navigate('/control/historial')}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-6">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <DialogTitle className="text-center text-2xl font-bold mb-2">¡Control Finalizado!</DialogTitle>
            <DialogDescription className="text-center mb-6">
              El control del pedido {controlData?.pedido?.pedidoId} se ha completado exitosamente.
              {controlData?.pedido?.armador && (
                <p className="mt-2 text-sm text-gray-600">
                  Pedido armado por: {
                    `${controlData.pedido.armador.firstName || ''} ${controlData.pedido.armador.lastName || ''} (${controlData.pedido.armador.username})`.trim()
                  }
                </p>
              )}
            </DialogDescription>
            <Button 
              onClick={() => navigate('/control/historial')} 
              className="w-full"
            >
              Volver al Historial
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de selección de motivo de pausa */}
      <Dialog open={showPausaDialog} onOpenChange={setShowPausaDialog}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-start py-4">
            <DialogTitle className="flex items-center text-xl mb-2">
              <PauseCircle className="mr-2 h-6 w-6 text-orange-500" />
              Pausar control
            </DialogTitle>
            <DialogDescription className="mb-4">
              Seleccione el motivo por el cual desea pausar el control del pedido {controlData?.pedido?.pedidoId}.
            </DialogDescription>
            
            <div className="w-full space-y-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo de pausa:</label>
                <Select value={motivoPausa} onValueChange={setMotivoPausa}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccione un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {motivosPausa.map(motivo => (
                      <SelectItem key={motivo} value={motivo}>
                        {motivo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 w-full">
              <Button 
                variant="outline" 
                onClick={() => setShowPausaDialog(false)}
              >
                Cancelar
              </Button>
              <Button 
                variant="default" 
                onClick={confirmarPausa}
                disabled={!motivoPausa || pausando}
              >
                {pausando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Pausando...
                  </>
                ) : (
                  "Confirmar pausa"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
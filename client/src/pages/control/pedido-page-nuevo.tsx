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
  
  // Manejar errores de forma más robusta
  useEffect(() => {
    const handleError = async () => {
      try {
        // Si hay un error de control, intentar reiniciar el control
        if (controlState.mensajeError === "No se pudo cargar la información del control") {
          console.log("Intentando reiniciar el control...");
          const resp = await fetch(`/api/control/pedidos/${pedidoId}/activo`);
          if (resp.status === 404) {
            // Intentar iniciar un nuevo control
            console.log("Control no encontrado, iniciando uno nuevo...");
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
            }
          }
        }
      } catch (error) {
        console.error("Error al intentar reiniciar el control:", error);
      }
    };
    
    if (controlState.mensajeError) {
      handleError();
    }
  }, [controlState.mensajeError, pedidoId, toast]);
  
  // Estado para diálogos y control
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [finalizandoControl, setFinalizandoControl] = useState(false);
  const [tabActiva, setTabActiva] = useState("productos");
  const [pausando, setPausando] = useState(false);
  const [pausado, setPausado] = useState(false);

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

  // Manejar escaneo exitoso
  const handleEscanearSuccess = (data: any) => {
    // Refrescar datos del control
    refetchControl();
    
    // Obtener información del producto para mostrar en la notificación
    const codigo = data?.codigo || data?.productoData?.codigo || 'Producto';
    const cantidad = data?.cantidadControlada || data?.cantidad || 1;
    
    // Mostrar confirmación
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
        title: 'Producto no encontrado',
        description: 'Este producto no pertenece a este pedido',
        variant: 'destructive'
      });
    }
  };

  // Manejar actualización de producto cuando se retira excedente
  const handleProductoUpdate = (productoActualizado: ProductoControlado) => {
    // Actualizar el estado local con el producto actualizado
    const nuevosProductos = controlState.productosControlados.map(p => 
      p.codigo === productoActualizado.codigo ? productoActualizado : p
    );
    
    setControlState(prevState => ({
      ...prevState,
      productosControlados: nuevosProductos
    }));
    
    // Refrescar datos del control
    refetchControl();
    
    // Mostrar confirmación
    toast({
      title: 'Producto actualizado',
      description: `Se ajustó la cantidad de ${productoActualizado.codigo} a ${productoActualizado.controlado}/${productoActualizado.cantidad}`,
    });
    
    // Verificar si todos los productos tienen las cantidades correctas
    const todosProductosCorrectos = nuevosProductos.every(p => p.controlado === p.cantidad);
    
    // Si todos están correctos, finalizar automáticamente el control
    if (todosProductosCorrectos && nuevosProductos.length > 0) {
      // Pequeña demora para que el usuario vea la notificación de producto actualizado
      setTimeout(() => {
        toast({
          title: 'Control completado',
          description: 'Todas las cantidades son correctas. Finalizando automáticamente...',
        });
        
        // Iniciar el proceso de finalización
        finalizarControlMutation.mutate();
      }, 1000);
    }
  };

  // Manejar finalización de control
  const handleFinalizarControl = () => {
    // Verificar si hay productos con excedentes
    const hayExcedentes = controlState.productosControlados.some(p => p.controlado > p.cantidad);
    
    if (hayExcedentes) {
      toast({
        title: 'Atención',
        description: 'Hay productos con excedentes. Por favor retire los excedentes antes de finalizar.',
        variant: 'destructive'
      });
      return;
    }
    
    // Abrir diálogo de confirmación
    setShowFinalizarDialog(true);
  };

  // Verificar si hay faltantes
  const hayFaltantes = controlState.productosControlados.some(p => p.controlado < p.cantidad);
  
  // Verificar si hay excedentes
  const hayExcedentes = controlState.productosControlados.some(p => p.controlado > p.cantidad);
  
  // Verificar si el control está completo (todos tienen la cantidad exacta)
  const controlCompleto = controlState.productosControlados.every(p => p.controlado === p.cantidad);
  
  // Contar productos
  const totalProductos = controlState.productosControlados.length;
  const productosCompletos = controlState.productosControlados.filter(p => p.controlado >= p.cantidad).length;
  
  // Verificar si hay productos que aún no se han escaneado
  const hayProductosSinEscanear = controlState.productosControlados.some(p => p.controlado === 0);

  // Volver a la lista de controles
  const volverALista = () => {
    navigate('/control');
  };

  // Manejar pedido ya controlado (respuesta especial del queryFn)
  if (controlData?.pedidoControlado) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert className="mb-4 bg-green-50 border-green-500">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-700">¡Control Finalizado!</AlertTitle>
          <AlertDescription className="text-green-600">
            El pedido {controlData.pedido?.pedidoId} ha sido controlado exitosamente.
          </AlertDescription>
        </Alert>
        <div className="flex gap-4 mt-4">
          <Button onClick={volverALista} variant="default">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la lista
          </Button>
        </div>
      </div>
    );
  }
  
  // Si hay error al cargar el control
  if (controlError) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            No se pudo cargar la información del control.
          </AlertDescription>
        </Alert>
        <Button onClick={volverALista} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la lista
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <PackageCheck className="mr-2 h-6 w-6 text-primary" />
            Control de pedido {controlData?.pedido?.pedidoId}
          </h1>
          <p className="text-gray-500 mt-1">
            {isLoadingControl ? 'Cargando información...' : 
              `Cliente: ${controlData?.pedido?.clienteId || 'No disponible'}`}
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={volverALista}
            className="flex-shrink-0"
            >
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          
          <Button 
            variant="default"
            onClick={handleFinalizarControl}
            disabled={isLoadingControl || hayExcedentes || finalizandoControl || controlState.productosControlados.length === 0}
            className="flex-shrink-0"
          >
            {finalizandoControl ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {hayFaltantes ? "Finalizar con faltantes" : "Finalizar control"}
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Resumen de estado */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center">
              <Packages className="h-8 w-8 mr-3 text-primary" />
              <div>
                <div className="text-sm text-gray-500">Total productos</div>
                <div className="text-2xl font-bold">{totalProductos}</div>
              </div>
            </div>
            
            <div className="flex items-center">
              <CheckCircle2 className="h-8 w-8 mr-3 text-green-500" />
              <div>
                <div className="text-sm text-gray-500">Productos completos</div>
                <div className="text-2xl font-bold">{productosCompletos}/{totalProductos}</div>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className={`h-8 w-8 mr-3 rounded-full flex items-center justify-center ${
                controlCompleto ? 'bg-green-100 text-green-600' : 
                hayFaltantes ? 'bg-yellow-100 text-yellow-600' : 
                'bg-red-100 text-red-600'
              }`}>
                {controlCompleto ? 
                  <CheckCircle2 className="h-5 w-5" /> : 
                  <AlertTriangle className="h-5 w-5" />
                }
              </div>
              <div>
                <div className="text-sm text-gray-500">Estado</div>
                <div className="text-lg font-semibold">
                  {controlCompleto ? 'Completo' : 
                    hayExcedentes ? 'Con excedentes' :
                    hayFaltantes ? 'Con faltantes' : 
                    'En proceso'
                  }
                </div>
              </div>
            </div>
            
            <div className="flex items-center">
              <Button
                variant={controlCompleto ? "default" : hayExcedentes ? "destructive" : "outline"}
                className="w-full"
                disabled={isLoadingControl || finalizandoControl || controlState.productosControlados.length === 0 || hayExcedentes}
                onClick={handleFinalizarControl}
              >
                {hayExcedentes ? (
                  <>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Retire excedentes
                  </>
                ) : controlCompleto ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Finalizar control
                  </>
                ) : (
                  <>
                    <InfoIcon className="mr-2 h-4 w-4" />
                    Finalizar con faltantes
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Contenido principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Columna de escaneo */}
        <div className="md:col-span-1">
          <Tabs value={tabActiva} onValueChange={setTabActiva} className="w-full">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="productos">Productos</TabsTrigger>
              <TabsTrigger value="escanear">Escanear</TabsTrigger>
            </TabsList>
            
            <TabsContent value="productos" className="mt-0">
              <ProductosEscaneadosLista 
                productos={controlState.productosControlados}
                title="Lista de productos"
                description={`${productosCompletos}/${totalProductos} productos completos`}
                emptyMessage="No hay productos para este pedido"
                pedidoId={pedidoId}
                isLoading={isLoadingControl}
                onProductoUpdate={handleProductoUpdate}
              />
            </TabsContent>
            
            <TabsContent value="escanear" className="mt-0">
              <ProductoEscanerSeguro
                pedidoId={pedidoId}
                onEscaneoSuccess={handleEscanearSuccess}
                onEscaneoError={handleEscanearError}
                disabled={isLoadingControl || finalizandoControl}
              />
              
              {hayProductosSinEscanear && (
                <Alert className="mt-4">
                  <InfoIcon className="h-4 w-4" />
                  <AlertTitle>Recordatorio</AlertTitle>
                  <AlertDescription>
                    Aún hay productos que no han sido escaneados.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Columna de productos controlados */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PackageCheck className="h-5 w-5 mr-2 text-primary" />
                Estado del Control
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingControl ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : controlState.productosControlados.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Packages className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay productos para controlar en este pedido</p>
                  <Button variant="outline" onClick={volverALista} className="mt-4">
                    Volver a la lista
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Resumen de excedentes */}
                  {hayExcedentes && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Excedentes detectados</AlertTitle>
                      <AlertDescription>
                        Hay productos con cantidades excedentes. 
                        Haga clic en cada producto con excedente para ajustar la cantidad.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Resumen de faltantes */}
                  {hayFaltantes && !hayExcedentes && (
                    <Alert className="mb-4 bg-yellow-50 border-yellow-200 text-yellow-800">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertTitle>Faltantes detectados</AlertTitle>
                      <AlertDescription>
                        Hay productos con cantidades faltantes. Puede finalizar el control 
                        con faltantes o continuar escaneando los productos.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Resumen de completos */}
                  {controlCompleto && !hayExcedentes && !hayFaltantes && (
                    <Alert className="mb-4 bg-green-50 border-green-200 text-green-800">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertTitle>Control completo</AlertTitle>
                      <AlertDescription>
                        Todos los productos han sido controlados correctamente.
                        Puede finalizar el control.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Separator className="my-4" />
                  
                  {/* Productos con excedentes */}
                  {hayExcedentes && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-3 flex items-center text-red-700">
                        <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
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
                                // Al hacer clic, simulamos el comportamiento de ProductosEscaneadosLista
                                handleProductoClick(producto);
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
    </div>
  );

  // Función para manejar el clic en producto (para mostrar diálogo de excedentes)
  function handleProductoClick(producto: ProductoControlado) {
    if (producto.controlado > producto.cantidad) {
      // Si hay excedente, configurar el estado para el diálogo de retirada
      handleProductoUpdate({
        ...producto,
        controlado: producto.cantidad,
        estado: 'correcto'
      });
    }
  }
}
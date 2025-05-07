import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ProductoControlado, ControlState } from '@shared/types';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle,
  CheckCircle2,
  InfoIcon,
  Loader2,
  Package,
  Packages,
  PauseCircle,
  PlayCircle,
  ScanLine,
  AlertTriangle,
} from 'lucide-react';
import { ProductoEscanerSeguroV2 } from '@/components/control/producto-escaner-v2';

// Componente para mostrar un producto en la lista de control
function ProductoControlItem({ producto, onProductoClick }: { 
  producto: ProductoControlado;
  onProductoClick?: (producto: ProductoControlado) => void;
}) {
  // Determinar el color según el estado
  const getStatusColor = () => {
    if (producto.controlado === producto.cantidad) {
      return "bg-green-100 border-green-300 text-green-800"; // Correcto - verde
    } else if (producto.controlado > producto.cantidad) {
      return "bg-red-100 border-red-300 text-red-800"; // Excedente - rojo
    } else if (producto.controlado > 0 && producto.controlado < producto.cantidad) {
      return "bg-yellow-100 border-yellow-300 text-yellow-800"; // Faltante - amarillo
    }
    return "bg-gray-100 border-gray-300 text-gray-800"; // Sin escanear - gris
  };

  const isClickable = producto.controlado > producto.cantidad;
  
  return (
    <div 
      className={`p-3 rounded-md border mb-2 ${getStatusColor()} ${isClickable ? 'cursor-pointer hover:opacity-90' : ''}`}
      onClick={() => isClickable && onProductoClick && onProductoClick(producto)}
    >
      <div className="flex justify-between items-center">
        <div>
          <div className="font-medium">{producto.codigo}</div>
          <div className="text-sm">{producto.descripcion}</div>
        </div>
        <div className="text-right">
          <div className="font-bold">
            {producto.controlado} / {producto.cantidad}
          </div>
          <div className="text-xs">
            {producto.controlado === producto.cantidad ? (
              "Completo"
            ) : producto.controlado > producto.cantidad ? (
              "Excedente"
            ) : producto.controlado > 0 ? (
              "Faltante"
            ) : (
              "Pendiente"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PedidoControlPage() {
  // 1. Configuración y hooks
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const pedidoId = params?.id ? parseInt(params.id) : null;
  const [pausaDialogOpen, setPausaDialogOpen] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState("Pausa para verificación");
  const [pausaActiva, setPausaActiva] = useState(false);
  const [pausaActualId, setPausaActualId] = useState<number | null>(null);
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [excedentesDialog, setExcedentesDialog] = useState<{
    open: boolean;
    producto: ProductoControlado | null;
  }>({
    open: false,
    producto: null
  });
  const [excedentesRetiradosDialog, setExcedentesRetiradosDialog] = useState<{
    open: boolean;
    producto: ProductoControlado | null;
  }>({
    open: false,
    producto: null
  });

  // Estado del control
  const [controlState, setControlState] = useState<ControlState>({
    isRunning: false,
    startTime: null,
    pedidoId: null,
    codigoPedido: null,
    clienteId: null,
    productosControlados: [],
    historialEscaneos: [],
    segundos: 0,
    pedidoYaControlado: false,
    mensajeError: null
  });

  // 2. Consultas y mutaciones
  // Consulta principal del pedido
  const pedidoQuery = useQuery({
    queryKey: ['/api/pedidos', pedidoId],
    queryFn: async () => {
      const res = await fetch(`/api/pedidos/${pedidoId}`);
      if (!res.ok) {
        throw new Error('Error al cargar el pedido');
      }
      return res.json();
    },
    enabled: !!pedidoId
  });

  // Consulta para obtener información del armador
  const controlArminfoQuery = useQuery({
    queryKey: ['/api/users', pedidoQuery.data?.armadorId, 'info'],
    queryFn: async () => {
      if (!pedidoQuery.data?.armadorId) throw new Error('No hay armador asignado');
      const res = await fetch(`/api/users/${pedidoQuery.data.armadorId}/info`);
      if (!res.ok) {
        throw new Error('No se pudo obtener información del armador');
      }
      return res.json();
    },
    enabled: !!pedidoQuery.data?.armadorId
  });

  // Consulta para obtener el control activo
  const controlActivoQuery = useQuery({
    queryKey: ['/api/control/pedidos', pedidoId, 'activo'],
    queryFn: async () => {
      const res = await fetch(`/api/control/pedidos/${pedidoId}/activo`);
      if (!res.ok) {
        throw new Error('Error al cargar estado del control');
      }
      return res.json();
    },
    enabled: !!pedidoId,
    onSuccess: (data) => {
      // Actualizar el estado de pausa
      const pausaActiva = data.pausaActiva === true;
      const pausaId = data.pausaId || null;
      
      // Actualizar estados
      setPausaActiva(pausaActiva);
      setPausaActualId(pausaId);
      
      // Inicializar estado del control
      setControlState({
        isRunning: !pausaActiva,
        startTime: new Date(data.control.fecha).getTime(),
        pedidoId: pedidoId,
        codigoPedido: data.pedido?.pedidoId || null,
        clienteId: data.pedido?.clienteId || null,
        productosControlados: data.productos.map((p: any) => {
          // Encontrar detalles de control para este producto
          const controlDetalles = data.detalles.filter((d: any) => 
            d.codigo === p.codigo
          );
          
          // Calcular cantidad controlada sumando todos los escaneos
          const cantidadControlada = controlDetalles.reduce((acc: number, d: any) => 
            acc + (d.cantidadControlada || 0), 0
          );
          
          // Determinar el estado basado en las cantidades
          let estado = "";
          if (cantidadControlada === 0) {
            estado = "pendiente";
          } else if (cantidadControlada < p.cantidad) {
            estado = "faltante";
          } else if (cantidadControlada === p.cantidad) {
            estado = "correcto";
          } else {
            estado = "excedente";
          }
          
          return {
            id: p.id,
            codigo: p.codigo ? String(p.codigo).trim() : "",
            cantidad: p.cantidad,
            controlado: cantidadControlada,
            descripcion: p.descripcion || "Sin descripción",
            ubicacion: p.ubicacion || "",
            estado: estado
          };
        }),
        historialEscaneos: data.detalles || [],
        segundos: Math.floor((Date.now() - new Date(data.control.fecha).getTime()) / 1000),
        pedidoYaControlado: false,
        mensajeError: null
      });
    }
  });

  const isLoadingControl = controlActivoQuery.isLoading || pedidoQuery.isLoading;

  // Mutación para pausar control
  const pausarControlMutation = useMutation({
    mutationFn: async (datos: { pedidoId: number, motivo: string }) => {
      const res = await fetch(`/api/control/pedidos/${datos.pedidoId}/pausar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ motivo: datos.motivo })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al pausar el control");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      setPausaActiva(true);
      setPausaActualId(data.pausa.id);
      setControlState(prev => ({
        ...prev,
        isRunning: false
      }));
      toast({
        title: "Control pausado",
        description: "El control del pedido ha sido pausado",
      });
      // Invalidar consultas
      queryClient.invalidateQueries({ queryKey: ['/api/control/pedidos', pedidoId, 'activo'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al pausar control",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutación para reanudar control
  const reanudarControlMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/control/pedidos/${pedidoId}/reanudar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al reanudar el control");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      setPausaActiva(false);
      setPausaActualId(null);
      setControlState(prev => ({
        ...prev,
        isRunning: true
      }));
      toast({
        title: "Control reanudado",
        description: "El control del pedido ha sido reanudado",
      });
      // Invalidar consultas
      queryClient.invalidateQueries({ queryKey: ['/api/control/pedidos', pedidoId, 'activo'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al reanudar control",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutación para finalizar control
  const finalizarControlMutation = useMutation({
    mutationFn: async (comentario: string = "") => {
      const res = await fetch(`/api/control/pedidos/${pedidoId}/finalizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comentario })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al finalizar el control");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      setControlState(prev => ({
        ...prev,
        pedidoYaControlado: true,
        isRunning: false
      }));
      setShowFinalizarDialog(false);
      toast({
        title: "Control finalizado",
        description: "El control del pedido ha sido finalizado correctamente",
      });
      // Invalidar consultas
      queryClient.invalidateQueries({ queryKey: ['/api/control/pedidos', pedidoId, 'activo'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pedidos', pedidoId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar control",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 3. Efectos y cálculos
  // Calcular estadísticas de control
  const totalProductos = controlState.productosControlados.reduce((acc, p) => acc + p.cantidad, 0);
  const escaneados = controlState.productosControlados.reduce((acc, p) => acc + p.controlado, 0);
  const hayFaltantes = controlState.productosControlados.some(p => p.controlado < p.cantidad);
  const hayExcedentes = controlState.productosControlados.some(p => p.controlado > p.cantidad);
  const permitirFinalizarConExcedentes = false; // Este valor podría venir de la configuración

  // Efecto para manejar el temporizador
  useEffect(() => {
    if (controlState.isRunning && !timerRef.current) {
      // Iniciar temporizador
      timerRef.current = setInterval(() => {
        setTimer(prev => (prev !== null ? prev + 1 : 0));
      }, 1000);
    } else if (!controlState.isRunning && timerRef.current) {
      // Detener temporizador
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Limpiar al desmontar
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [controlState.isRunning]);

  // Autocompletar cuando todos los productos están escaneados correctamente
  useEffect(() => {
    const todosProductosCorrectos = controlState.productosControlados.every(
      p => p.controlado === p.cantidad
    );
    
    if (todosProductosCorrectos && 
        controlState.productosControlados.length > 0 && 
        controlState.isRunning && 
        !controlState.pedidoYaControlado) {
      // Todos los productos escaneados correctamente, finalizar automáticamente
      handleFinalizarControl();
    }
  }, [controlState.productosControlados, controlState.isRunning, controlState.pedidoYaControlado]);

  // 4. Manejadores de eventos
  // Volver a la lista de pedidos
  const volverALista = () => {
    window.location.href = "/control";
  };

  // Funciones para pausar y reanudar
  const handlePausarControl = () => {
    setPausaDialogOpen(true);
  };

  const handleConfirmarPausa = () => {
    pausarControlMutation.mutate({ 
      pedidoId: pedidoId!,
      motivo: motivoPausa
    });
    setPausaDialogOpen(false);
  };

  const handleReanudarControl = () => {
    reanudarControlMutation.mutate();
  };

  // Finalizar control
  const handleFinalizarControl = () => {
    // Verificar si hay excedentes y no se permite finalizar con ellos
    if (hayExcedentes && !permitirFinalizarConExcedentes) {
      toast({
        title: "No se puede finalizar",
        description: "Hay productos con excedentes. Debe retirar los excedentes antes de finalizar.",
        variant: "destructive",
      });
      return;
    }
    
    setShowFinalizarDialog(true);
  };
  
  // Manejar escaneo de productos
  const handleEscaneo = async (codigo: string, cantidad: number = 1) => {
    // Evitar escaneo si el control no está en ejecución, está pausado, o ya fue controlado
    if (!controlState.isRunning || pausaActiva || controlState.pedidoYaControlado) {
      if (pausaActiva) {
        toast({
          title: "Control pausado",
          description: "No se pueden escanear productos mientras el control está pausado. Reanude el control para continuar.",
          variant: "destructive",
        });
      }
      return;
    }
    
    try {
      const response = await fetch(`/api/control/pedidos/${pedidoId}/escanear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          codigo,
          cantidad: cantidad || 1 // Asegurarnos de enviar al menos 1
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Si el producto no existe en el pedido
        if (data.message?.includes('no existe en el pedido')) {
          toast({
            title: "Producto no encontrado",
            description: "El código escaneado no pertenece a este pedido. Por favor, retire el producto.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error al escanear",
            description: data.message || "No se pudo escanear el producto",
            variant: "destructive",
          });
        }
        return;
      }
      
      // Recargar los datos del control
      queryClient.invalidateQueries({ queryKey: ['/api/control/pedidos', pedidoId, 'activo'] });
      
      // Si el escaneo ha causado un excedente, mostrar toast
      if (data.excedente) {
        toast({
          title: "Excedente detectado",
          description: `El producto ${codigo} tiene un excedente. Haga clic en el producto para retirar el excedente.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al escanear producto:", error);
      toast({
        title: "Error",
        description: "No se pudo escanear el producto. Intente nuevamente.",
        variant: "destructive",
      });
    }
  };
  
  // Manejar clic en un producto
  const handleProductoClick = (producto: ProductoControlado) => {
    if (producto.controlado > producto.cantidad) {
      setExcedentesDialog({
        open: true,
        producto
      });
    }
  };
  
  // Cerrar el diálogo de excedentes
  const handleCloseExcedentes = () => {
    setExcedentesDialog({
      open: false,
      producto: null
    });
  };
  
  // Confirmar la retirada de excedentes
  const handleConfirmExcedentes = () => {
    // Cerrar diálogo de excedentes
    setExcedentesDialog({
      open: false,
      producto: null
    });
    
    // Si hay un producto, abrir diálogo de confirmación
    if (excedentesDialog.producto) {
      // Guardamos el producto para mostrar en la confirmación
      const productoRetirado = excedentesDialog.producto;
      
      // Actualizar la lista de productos controlados
      queryClient.invalidateQueries({ queryKey: ['/api/control/pedidos', pedidoId, 'activo'] });
      
      // Mostrar diálogo de confirmación de excedente retirado
      setExcedentesRetiradosDialog({
        open: true,
        producto: productoRetirado
      });
    }
  };
  
  // Cerrar diálogo de confirmación de excedentes retirados
  const handleCloseExcedentesRetirados = () => {
    setExcedentesRetiradosDialog({
      open: false,
      producto: null
    });
  };

  // Función para formatear el tiempo
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  // 5. Opciones de pausa
  const opcionesPausa = [
    "Pausa para verificación",
    "Producto dañado o incorrecto",
    "Interrupción externa",
    "Descanso",
    "Otro"
  ];

  // 6. Renderizado
  return (
    <MainLayout>
      {/* Diálogo para seleccionar motivo de pausa */}
      <Dialog open={pausaDialogOpen} onOpenChange={setPausaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccione motivo de pausa</DialogTitle>
            <DialogDescription>
              Indique el motivo por el cual está pausando el control del pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <RadioGroup value={motivoPausa} onValueChange={setMotivoPausa} className="space-y-2">
              {opcionesPausa.map((opcion) => (
                <div key={opcion} className="flex items-center space-x-2">
                  <RadioGroupItem value={opcion} id={`opcion-${opcion}`} />
                  <Label htmlFor={`opcion-${opcion}`}>{opcion}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPausaDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmarPausa}>Pausar control</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de excedentes */}
      <Dialog open={excedentesDialog.open} onOpenChange={handleCloseExcedentes}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excedente detectado</DialogTitle>
            <DialogDescription>
              El producto {excedentesDialog.producto?.codigo} tiene {' '}
              {excedentesDialog.producto ? (excedentesDialog.producto.controlado - excedentesDialog.producto.cantidad) : 0} unidad(es) de excedente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-4">
              Por favor, retire el excedente del pedido para continuar con el control.
            </p>
            <div className="p-3 rounded-md border bg-gray-100">
              <p className="font-bold">{excedentesDialog.producto?.codigo}</p>
              <p>{excedentesDialog.producto?.descripcion}</p>
              <p className="mt-1">
                <span className="font-semibold">Cantidad correcta:</span> {excedentesDialog.producto?.cantidad}
              </p>
              <p>
                <span className="font-semibold">Cantidad escaneada:</span> {excedentesDialog.producto?.controlado}
              </p>
              <p className="mt-1 text-red-600 font-semibold">
                Excedente: {excedentesDialog.producto ? (excedentesDialog.producto.controlado - excedentesDialog.producto.cantidad) : 0} unidad(es)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseExcedentes}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmExcedentes}>
              Confirmar retirada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación de excedentes retirados */}
      <Dialog open={excedentesRetiradosDialog.open} onOpenChange={handleCloseExcedentesRetirados}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excedente retirado</DialogTitle>
            <DialogDescription>
              El excedente del producto ha sido retirado correctamente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-3 rounded-md border bg-green-100">
              <p className="font-bold">{excedentesRetiradosDialog.producto?.codigo}</p>
              <p>{excedentesRetiradosDialog.producto?.descripcion}</p>
              <p className="mt-1">
                <span className="font-semibold">Cantidad correcta:</span> {excedentesRetiradosDialog.producto?.cantidad}
              </p>
              <p className="mt-1 text-green-600 font-semibold">
                Estado: Correcto
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCloseExcedentesRetirados}>
              Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para finalizar control */}
      <Dialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar control</DialogTitle>
            <DialogDescription>
              {hayFaltantes 
                ? "Hay productos con faltantes. ¿Está seguro que desea finalizar el control?"
                : "¿Está seguro que desea finalizar el control de este pedido?"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {hayFaltantes && (
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Faltantes detectados</AlertTitle>
                <AlertDescription>
                  Se han detectado productos con faltantes. Se registrará esta información.
                </AlertDescription>
              </Alert>
            )}
            <p>El control se finalizará y no podrá ser modificado posteriormente.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalizarDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => finalizarControlMutation.mutate("")}
              disabled={finalizarControlMutation.isPending}
            >
              {finalizarControlMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finalizando...
                </>
              ) : (
                "Finalizar control"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contenido principal */}
      <div className="container mx-auto py-6 max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={volverALista} className="flex items-center gap-1 pl-0 hover:bg-transparent hover:pl-0">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          
          <div className="flex items-center gap-2">
            {/* Botón para pausar/reanudar el control */}
            {!controlState.pedidoYaControlado && (
              <>
                {!pausaActiva ? (
                  <Button
                    variant="outline"
                    onClick={handlePausarControl}
                    disabled={isLoadingControl || !controlState.isRunning}
                    className="flex items-center gap-1"
                  >
                    <PauseCircle className="h-4 w-4" />
                    Pausar control
                  </Button>
                ) : (
                  <Button
                    onClick={handleReanudarControl}
                    disabled={isLoadingControl}
                    className="flex items-center gap-1"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Reanudar control
                  </Button>
                )}
              </>
            )}
            
            {/* Botón para finalizar control */}
            <Button
              onClick={handleFinalizarControl}
              disabled={isLoadingControl || controlState.pedidoYaControlado || (hayExcedentes && !permitirFinalizarConExcedentes)}
              className="flex items-center gap-1"
            >
              <CheckCircle2 className="h-4 w-4" />
              Finalizar {hayFaltantes ? 'con faltantes' : 'control'}
            </Button>
          </div>
        </div>
        
        {pedidoQuery.data?.estado === "armado-pendiente-stock" && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Pedido con stock pendiente</AlertTitle>
            <AlertDescription>
              Este pedido tiene productos con stock pendiente. No se puede iniciar el control hasta que se complete el stock.
            </AlertDescription>
          </Alert>
        )}
        
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl flex items-center">
                  Control de pedido {controlState.codigoPedido}
                </CardTitle>
                <p className="text-gray-500 mt-1">
                  Cliente: {pedidoQuery.data?.clienteId || controlState.clienteId || 'No especificado'}
                </p>
                {controlArminfoQuery.data && (
                  <p className="text-sm text-gray-500 mt-1">
                    Armado por: {typeof controlArminfoQuery.data === 'string' ? controlArminfoQuery.data : controlArminfoQuery.data?.username || 'No especificado'}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col items-end">
                <div className="flex gap-4 mb-2">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-500">Total productos</p>
                    <p className="text-2xl font-bold">{totalProductos}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-500">Productos escaneados</p>
                    <p className="text-2xl font-bold">{escaneados}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-500">Estado</p>
                    <p className={`text-lg font-bold ${hayExcedentes ? "text-red-600" : hayFaltantes ? "text-yellow-600" : "text-green-600"}`}>
                      {hayExcedentes ? "Con excedentes" : hayFaltantes ? "Con faltantes" : "Completo"}
                    </p>
                  </div>
                </div>
                
                {timer !== null && (
                  <div className="flex items-center text-gray-500">
                    <p className="text-sm">Tiempo: {formatTime(timer)}</p>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
        
        {/* Nuevo layout de dos columnas fijas - Escaner siempre visible a la izquierda */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Columna izquierda - Scanner (siempre visible) */}
          <div className="md:col-span-5 md:sticky md:top-6 self-start">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Packages className="h-5 w-5 mr-2 text-primary" />
                  Escanear Productos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingControl ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : controlState.pedidoYaControlado ? (
                  <Alert className="mb-4">
                    <InfoIcon className="h-4 w-4" />
                    <AlertTitle>Pedido ya controlado</AlertTitle>
                    <AlertDescription>
                      Este pedido ya ha sido controlado y finalizado.
                    </AlertDescription>
                  </Alert>
                ) : pedidoQuery.data?.estado === 'armado-pendiente-stock' ? (
                  <Alert className="mb-4 bg-amber-50 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Pedido con stock pendiente</AlertTitle>
                    <AlertDescription className="text-amber-700">
                      Este pedido tiene productos con faltantes de stock y no puede ser controlado hasta que se resuelvan.
                    </AlertDescription>
                  </Alert>
                ) : !controlState.isRunning && pausaActiva ? (
                  <Alert className="mb-4">
                    <InfoIcon className="h-4 w-4" />
                    <AlertTitle>Control pausado</AlertTitle>
                    <AlertDescription>
                      El control está pausado. Haga clic en "Reanudar control" para continuar.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ProductoEscanerSeguroV2 
                    onEscaneo={handleEscaneo}
                    disabled={!controlState.isRunning || pausaActiva || controlState.pedidoYaControlado}
                    buttonText="Escanear producto"
                    className="w-full"
                  />
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Columna derecha - Estado del control */}
          <div className="md:col-span-7">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 mr-2 text-primary" />
                  Estado del Control
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingControl ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : controlState.productosControlados.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">No hay productos para controlar en este pedido.</p>
                    <Button 
                      variant="outline" 
                      onClick={volverALista} 
                      className="mt-4"
                    >
                      Volver a la lista
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {controlState.productosControlados.map((producto) => (
                      <ProductoControlItem 
                        key={producto.codigo} 
                        producto={producto} 
                        onProductoClick={handleProductoClick}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
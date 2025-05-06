import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ProductoControlado, ControlState } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
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

import { ProductoEscanerSeguro } from '@/components/control/producto-escaner-seguro';
import { ProductosEscaneadosLista } from '@/components/control/productos-escaneados-lista';
import { RetirarExcedenteDialogNuevo } from '@/components/control/retirar-excedente-dialog-nuevo';

export default function ControlPedidoColumnasPage() {
  const { id } = useParams<{ id: string }>();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const pedidoId = id ? parseInt(id) : null;
  
  // Debug info
  console.log("⚠️ ControlPedidoColumnasPage - ID en URL:", id);
  console.log("⚠️ ControlPedidoColumnasPage - pedidoId procesado:", pedidoId);
  
  // Validación del pedidoId
  useEffect(() => {
    if (!id || !pedidoId || isNaN(pedidoId)) {
      toast({
        title: "Error de pedido",
        description: "El ID del pedido no es válido",
        variant: "destructive"
      });
      navigate('/control');
    }
  }, [id, pedidoId, navigate, toast]);
  
  // Estado para controlar si el pedido está pausado
  const [pausaActiva, setPausaActiva] = useState(false);
  
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
  
  // Estado para el diálogo de excedentes
  const [excedentesDialog, setExcedentesDialog] = useState<{
    open: boolean;
    producto: ProductoControlado | null;
  }>({
    open: false,
    producto: null
  });
  
  // Estado para el diálogo de confirmación de excedentes retirados
  const [excedentesRetiradosDialog, setExcedentesRetiradosDialog] = useState<{
    open: boolean;
    producto: ProductoControlado | null;
  }>({
    open: false,
    producto: null
  });
  
  // Estados para finalización
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [showExitoDialog, setShowExitoDialog] = useState(false);
  const [finalizandoControl, setFinalizandoControl] = useState(false);
  const [permitirFinalizarConExcedentes, setPermitirFinalizarConExcedentes] = useState(false);
  
  // Estado para el diálogo de pausa
  const [pausaDialogOpen, setPausaDialogOpen] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState("Pausa manual");
  const opcionesPausa = [
    "Pausa manual", 
    "Producto dañado", 
    "Falta de stock", 
    "Verificación de datos", 
    "Cambio de turno",
    "Otro"
  ];
  
  // Timer
  const [timer, setTimer] = useState<number | null>(null);
  
  // Consultar información del pedido
  const pedidoQuery = useQuery({
    queryKey: ['/api/pedidos', pedidoId],
    enabled: !!pedidoId
  });
  
  // Consultar información de quién armó el pedido
  const controlArminfoQuery = useQuery({
    queryKey: ['/api/control/pedidos', pedidoId, 'arminfo'],
    enabled: !!pedidoId
  });
  
  // Consultar control activo
  const controlActivoQuery = useQuery({
    queryKey: ['/api/control/pedidos', pedidoId, 'activo'],
    refetchInterval: controlState.isRunning ? 3000 : false,
    retry: false,
    onSuccess: (data: any) => {
      // Actualizar estado local con datos del servidor
      const productosOrdenados = [...data.productos].sort((a: any, b: any) => a.codigo.localeCompare(b.codigo));
      
      // Verificar si hay una pausa activa
      const tienePausaActiva = data.pausaActiva === true;
      console.log("Estado de pausa recibido:", tienePausaActiva ? "ACTIVA" : "INACTIVA");
      setPausaActiva(tienePausaActiva);
      
      setControlState(prev => ({
        ...prev,
        isRunning: data.control.estado === 'activo' && !tienePausaActiva,
        startTime: data.control.inicio ? new Date(data.control.inicio).getTime() : null,
        pedidoId: data.pedidoId,
        codigoPedido: data.codigoPedido,
        productosControlados: productosOrdenados,
        segundos: data.segundos || 0,
        pedidoYaControlado: data.pedidoYaControlado || false,
        mensajeError: null,
        historialEscaneos: prev.historialEscaneos // Mantener el historial de escaneos local
      }));
    },
    onError: (error: Error) => {
      console.error("Error al cargar control activo:", error);
      setControlState(prev => ({
        ...prev,
        mensajeError: "No se pudo cargar la información del control"
      }));
    }
  });
  
  // Manejar errores de control
  useEffect(() => {
    const handleError = async () => {
      try {
        if (controlState.mensajeError === "No se pudo cargar la información del control") {
          console.log("Intentando reiniciar el control...");
          
          // Verificar primero si el pedido tiene estado "armado-pendiente-stock"
          const pedidoData = pedidoQuery.data;
          if (pedidoData && pedidoData.estado === "armado-pendiente-stock") {
            console.log("Pedido con stock pendiente, no se puede iniciar control");
            toast({
              title: "No se puede iniciar el control",
              description: "Este pedido tiene productos con stock pendiente. Complete el stock antes de controlar.",
              variant: "destructive"
            });
            return;
          }
          
          const resp = await fetch(`/api/control/pedidos/${pedidoId}/activo`);
          if (resp.status === 404) {
            console.log("Control no encontrado, iniciando uno nuevo...");
            
            // Verificar nuevamente el estado del pedido antes de iniciar control
            if (pedidoData && pedidoData.estado === "armado-pendiente-stock") {
              toast({
                title: "No se puede iniciar el control",
                description: "Este pedido tiene productos con stock pendiente. Complete el stock antes de controlar.",
                variant: "destructive"
              });
              return;
            }
            
            const initResp = await fetch(`/api/control/pedidos/${pedidoId}/iniciar`, {
              method: 'POST'
            });
            
            if (initResp.ok) {
              toast({
                title: "Control iniciado",
                description: "Se ha iniciado un nuevo control para este pedido",
                variant: "default"
              });
              window.location.reload();
            }
          }
        }
      } catch (error) {
        console.error("Error al intentar reiniciar el control:", error);
      }
    };
    
    if (controlState.mensajeError && pedidoQuery.data) {
      handleError();
    }
  }, [controlState.mensajeError, pedidoId, toast, pedidoQuery.data]);
  
  // Timer para el control - Usando una referencia para evitar reinicios
  // Creamos referencia para el intervalo para evitar reinicios
  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Limpiar cualquier intervalo existente para prevenir duplicados
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    // Solo crear un nuevo intervalo si el control está activo
    if (controlState.isRunning && !controlState.pedidoYaControlado) {
      console.log("✓ Iniciando temporizador de columnas (una sola vez)");
      timerIntervalRef.current = setInterval(() => {
        setControlState(prev => ({
          ...prev,
          segundos: prev.segundos + 1
        }));
        setTimer(prev => (prev !== null ? prev + 1 : 0));
      }, 1000);
    }
    
    // Limpieza al desmontar
    return () => {
      if (timerIntervalRef.current) {
        console.log("✓ Limpiando intervalo de temporizador en columnas");
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [controlState.isRunning]); // Solo depende de isRunning
  
  // Calcular estado del control
  const totalProductos = controlState.productosControlados.reduce((acc, p) => acc + p.cantidad, 0);
  const escaneados = controlState.productosControlados.reduce((acc, p) => acc + Math.min(p.controlado, p.cantidad), 0);
  const hayExcedentes = controlState.productosControlados.some(p => p.controlado > p.cantidad);
  const hayFaltantes = controlState.productosControlados.some(p => p.controlado < p.cantidad);
  const controlCompleto = escaneados === totalProductos && !hayExcedentes;
  const productosCompletos = controlState.productosControlados
    .filter(p => p.controlado === p.cantidad && p.controlado > 0);
  const totalItemsCompletos = productosCompletos.length;
  const isLoadingControl = controlActivoQuery.isLoading;
  
  // Formatear tiempo
  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  
  // Volver a la lista de pedidos
  const volverALista = () => {
    navigate('/control');
  };
  
  // Mutación para pausar control
  const pausarControlMutation = useMutation({
    mutationFn: async (motivo: string = "Pausa manual") => {
      const response = await fetch(`/api/control/pedidos/${pedidoId}/pausar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ motivo })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Error al pausar el control");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Control pausado",
        description: "El control ha sido pausado correctamente",
      });
      
      // Actualizar el estado de pausa
      setPausaActiva(true);
      
      // Actualizar el estado local
      setControlState(prev => ({
        ...prev,
        isRunning: false
      }));
      
      // Invalidar la consulta para recargar datos
      queryClient.invalidateQueries({ queryKey: ['/api/control/pedidos', pedidoId, 'activo'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo pausar el control",
        variant: "destructive",
      });
    }
  });
  
  // Mutación para reanudar control
  const reanudarControlMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/control/pedidos/${pedidoId}/reanudar`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Error al reanudar el control");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Control reanudado",
        description: "El control ha sido reanudado correctamente",
      });
      
      // Actualizar el estado de pausa
      setPausaActiva(false);
      
      // Actualizar el estado local
      setControlState(prev => ({
        ...prev,
        isRunning: true
      }));
      
      // Invalidar la consulta para recargar datos
      queryClient.invalidateQueries({ queryKey: ['/api/control/pedidos', pedidoId, 'activo'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo reanudar el control",
        variant: "destructive",
      });
    }
  });
  
  // Mutación para finalizar control
  const finalizarControlMutation = useMutation({
    mutationFn: async () => {
      setFinalizandoControl(true);
      
      const response = await fetch(`/api/control/pedidos/${pedidoId}/finalizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          permitirFaltantes: hayFaltantes,
          permitirExcedentes: permitirFinalizarConExcedentes && hayExcedentes
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Error al finalizar el control");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setFinalizandoControl(false);
      setShowFinalizarDialog(false);
      setShowExitoDialog(true);
      
      // Actualizar el estado local
      setControlState(prev => ({
        ...prev,
        isRunning: false,
        pedidoYaControlado: true
      }));
      
      // Invalidar consultas relevantes
      queryClient.invalidateQueries({ queryKey: ['/api/control/pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pedidos'] });
    },
    onError: (error: Error) => {
      setFinalizandoControl(false);
      setShowFinalizarDialog(false);
      
      toast({
        title: "Error",
        description: error.message || "No se pudo finalizar el control",
        variant: "destructive",
      });
    }
  });
  
  // Manejar clic en botón de pausar
  const handlePausarControl = () => {
    if (controlState.isRunning) {
      setPausaDialogOpen(true); // Abre el diálogo para seleccionar motivo
    }
  };
  
  // Manejar la confirmación de pausa con un motivo seleccionado
  const handleConfirmarPausa = () => {
    if (controlState.isRunning) {
      pausarControlMutation.mutate(motivoPausa);
      setPausaDialogOpen(false);
    }
  };
  
  // Manejar clic en botón de reanudar
  const handleReanudarControl = () => {
    if (!controlState.isRunning) {
      reanudarControlMutation.mutate();
    }
  };
  
  // Manejar clic en botón de finalizar
  const handleFinalizarControl = () => {
    if (hayExcedentes && !permitirFinalizarConExcedentes) {
      toast({
        title: "No se puede finalizar",
        description: "Debe retirar los excedentes antes de finalizar el control",
        variant: "destructive",
      });
      return;
    }
    
    setShowFinalizarDialog(true);
  };
  
  // Manejar escaneo de productos
  const handleEscaneo = async (codigo: string) => {
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
        body: JSON.stringify({ codigo })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast({
          title: "Error al escanear",
          description: data.message || "No se pudo escanear el producto",
          variant: "destructive",
        });
        return;
      }
      
      // Recargar los datos del control
      queryClient.invalidateQueries({ queryKey: ['/api/control/pedidos', pedidoId, 'activo'] });
      
      // Actualizar el historial de escaneos
      setControlState(prev => ({
        ...prev,
        historialEscaneos: [
          { codigo, timestamp: new Date().toISOString() },
          ...prev.historialEscaneos
        ]
      }));
      
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
  
  // Actualizar un producto (para excedentes retirados)
  const handleProductoUpdate = (productoActualizado: ProductoControlado) => {
    setControlState(prev => ({
      ...prev,
      productosControlados: prev.productosControlados.map(p => 
        p.codigo === productoActualizado.codigo ? productoActualizado : p
      )
    }));
  };
  
  // Rendering principal
  return (
    <div className="container mx-auto py-6 max-w-7xl">
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
      
      <div className="flex justify-between items-center mb-6">
        <Button variant="ghost" onClick={volverALista} className="flex items-center gap-1 pl-0 hover:bg-transparent hover:pl-0">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        
        <div className="flex items-center gap-2">
          {/* Botón para pausar/reanudar el control */}
          {(!pausaActiva && controlState.isRunning) && (
            <Button
              variant="outline"
              onClick={handlePausarControl}
              disabled={isLoadingControl || controlState.pedidoYaControlado}
              className="flex items-center gap-1"
            >
              <PauseCircle className="h-4 w-4" />
              Pausar control
            </Button>
          )}
          
          {pausaActiva && !controlState.pedidoYaControlado && (
            <Button
              onClick={handleReanudarControl}
              disabled={isLoadingControl}
              className="flex items-center gap-1"
            >
              <PlayCircle className="h-4 w-4" />
              Reanudar control
            </Button>
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
              {(
                <p className="text-gray-500 mt-1">
                  Cliente: {controlState.codigoPedido ? controlState.codigoPedido : 'No especificado'}
                  {pedidoQuery.data?.cliente ? ` - ${pedidoQuery.data.cliente}` : ''}
                </p>
              )}
              {controlArminfoQuery.data && (
                <p className="text-sm text-gray-500 mt-1">
                  Armado por: {typeof controlArminfoQuery.data === 'string' ? controlArminfoQuery.data : 'No especificado'}
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
                <ProductoEscanerSeguro 
                  onEscaneo={handleEscaneo} 
                  allowOverflow={true} 
                  buttonText="Escanear producto"
                  showEscanerAutomatico={true}
                />
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Columna derecha - Productos escaneados y detalles */}
        <div className="md:col-span-7">
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
                                handleProductoClick(producto);
                              }}
                            >
                              <div>
                                <div className="font-medium">{producto.codigo}</div>
                                <div className="text-sm text-gray-600">{producto.descripcion}</div>
                              </div>
                              <div className="text-red-700 font-bold text-lg">
                                Retirar {producto.controlado - producto.cantidad} unidad(es)
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
                  {productosCompletos.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-3 flex items-center text-green-700">
                        <CheckCircle2 className="h-5 w-5 mr-2 text-green-600" />
                        Productos completos
                      </h3>
                      <div className="space-y-3">
                        {productosCompletos.map(producto => (
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
      
      {/* Modal de retirar excedentes */}
      {excedentesDialog.producto && (
        <RetirarExcedenteDialogNuevo 
          open={excedentesDialog.open}
          onClose={handleCloseExcedentes}
          onConfirm={handleConfirmExcedentes}
          producto={excedentesDialog.producto}
          pedidoId={pedidoId}
        />
      )}
      
      {/* Modal de confirmación de excedentes retirados */}
      <Dialog open={excedentesRetiradosDialog.open} onOpenChange={handleCloseExcedentesRetirados}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-green-700">
              <CheckCircle2 className="h-6 w-6 mr-2 text-green-600" />
              Excedente retirado con éxito
            </DialogTitle>
            <DialogDescription>
              {excedentesRetiradosDialog.producto && (
                <div className="py-4">
                  <p className="mb-2">
                    Se ha retirado el excedente del producto <span className="font-medium">{excedentesRetiradosDialog.producto.codigo}</span>.
                  </p>
                  <p className="text-sm text-gray-600">
                    Cantidad ajustada de {excedentesRetiradosDialog.producto.controlado} a {excedentesRetiradosDialog.producto.cantidad} unidades.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleCloseExcedentesRetirados}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de confirmación de finalización */}
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
          <DialogHeader>
            <DialogTitle className="flex items-center text-green-700">
              <CheckCircle2 className="h-6 w-6 mr-2 text-green-600" />
              Control finalizado con éxito
            </DialogTitle>
            <DialogDescription>
              <div className="py-4">
                <p>
                  El control del pedido <span className="font-medium">{controlState.codigoPedido}</span> ha sido finalizado correctamente.
                </p>
                {hayFaltantes && (
                  <p className="mt-2 text-yellow-700">
                    El control ha sido finalizado con faltantes.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => navigate('/control/historial')}>
              Ver historial de controles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  Package,
  ScanLine,
  AlertTriangle,
  ShoppingBag
} from 'lucide-react';
import { ProductoEscanerSeguroV2 } from '@/components/control/producto-escaner-v2';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ProductoControlado = {
  id: number;
  codigo: string;
  cantidad: number;
  controlado: number;
  descripcion: string;
  estado: 'pendiente' | 'faltante' | 'correcto' | 'excedente';
};

export default function ControlPedidoSimplePage() {
  // Configuración y hooks
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const pedidoId = params?.id ? parseInt(params.id) : null;
  
  // Estados locales
  const [productosControlados, setProductosControlados] = useState<ProductoControlado[]>([]);
  const [finalizadoDialogOpen, setFinalizadoDialogOpen] = useState(false);
  const [productoNoEncontradoDialog, setProductoNoEncontradoDialog] = useState({
    open: false,
    codigo: ''
  });
  
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
    enabled: !!pedidoId
  });
  
  // Efecto para cargar datos cuando se reciben las respuestas de las consultas
  useEffect(() => {
    if (controlActivoQuery.data && controlActivoQuery.data.productos) {
      const procesados = controlActivoQuery.data.productos.map((p: any) => {
        // Encontrar detalles de control para este producto
        const controlDetalles = controlActivoQuery.data.detalles.filter((d: any) => 
          d.codigo === p.codigo
        );
        
        // Calcular cantidad controlada sumando todos los escaneos
        const cantidadControlada = controlDetalles.reduce((acc: number, d: any) => 
          acc + (d.cantidadControlada || 0), 0
        );
        
        // Determinar el estado basado en las cantidades
        let estado: 'pendiente' | 'faltante' | 'correcto' | 'excedente' = 'pendiente';
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
          estado: estado
        };
      });
      
      setProductosControlados(procesados);
    }
  }, [controlActivoQuery.data]);
  
  // Función para finalizar control automáticamente cuando todos los productos están correctos
  useEffect(() => {
    if (productosControlados.length > 0) {
      const todosCorrectos = productosControlados.every(p => p.estado === 'correcto');
      if (todosCorrectos) {
        handleFinalizarControl();
      }
    }
  }, [productosControlados]);

  // Mutación para finalizar control
  const finalizarControlMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/control/pedidos/${pedidoId}/finalizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comentario: "Control finalizado automáticamente" })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al finalizar el control");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      setFinalizadoDialogOpen(true);
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
    }
  });

  // Manejar escaneo de productos
  const handleEscaneo = async (codigo: string, cantidad: number = 1) => {
    try {
      const response = await fetch(`/api/control/pedidos/${pedidoId}/escanear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          codigo,
          cantidad: cantidad || 1
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Si el producto no existe en el pedido
        if (data.message?.includes('no existe en el pedido') || data.error?.includes('no encontrado')) {
          setProductoNoEncontradoDialog({
            open: true,
            codigo
          });
          return;
        } else {
          toast({
            title: "Error al escanear",
            description: data.message || data.error || "No se pudo escanear el producto",
            variant: "destructive",
          });
        }
        return;
      }
      
      // Recargar los datos del control
      queryClient.invalidateQueries({ queryKey: ['/api/control/pedidos', pedidoId, 'activo'] });
      
      // Si hay un mensaje de finalización automática
      if (data.finalizadoAutomaticamente) {
        setFinalizadoDialogOpen(true);
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
  
  // Funciones auxiliares
  const handleFinalizarControl = () => {
    finalizarControlMutation.mutate();
  };
  
  const volverALista = () => {
    window.location.href = "/control";
  };
  
  // Estado de carga
  const isLoading = pedidoQuery.isLoading || controlActivoQuery.isLoading;
  
  // Calcular totales
  const totalProductos = productosControlados.reduce((acc, p) => acc + p.cantidad, 0);
  const escaneados = productosControlados.reduce((acc, p) => acc + p.controlado, 0);
  
  return (
    <MainLayout>
      {/* Diálogo para producto no encontrado */}
      <Dialog open={productoNoEncontradoDialog.open} onOpenChange={(open) => 
        setProductoNoEncontradoDialog(prev => ({ ...prev, open }))
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Producto no encontrado</DialogTitle>
            <DialogDescription>
              El código <strong>{productoNoEncontradoDialog.codigo}</strong> no pertenece a este pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atención</AlertTitle>
              <AlertDescription>
                Por favor retire este producto del pedido ya que no corresponde al mismo.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button onClick={() => 
              setProductoNoEncontradoDialog(prev => ({ ...prev, open: false }))
            }>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo para control finalizado */}
      <Dialog open={finalizadoDialogOpen} onOpenChange={setFinalizadoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Control finalizado correctamente</DialogTitle>
            <DialogDescription>
              Todos los productos han sido controlados correctamente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <DialogFooter>
            <Button onClick={volverALista}>
              Volver a la lista
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
        </div>
        
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl flex items-center">
                  Control de pedido {pedidoQuery.data?.pedidoId || ''}
                </CardTitle>
                <p className="text-gray-500 mt-1">
                  Cliente: {pedidoQuery.data?.clienteId || 'No especificado'}
                </p>
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
                    <p className={`text-lg font-bold ${
                      totalProductos === escaneados ? "text-green-600" : "text-yellow-600"
                    }`}>
                      {totalProductos === escaneados ? "Completo" : "En proceso"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
        
        {/* Layout de dos columnas */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Columna izquierda - Scanner */}
          <div className="md:col-span-5 md:sticky md:top-6 self-start">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ScanLine className="h-5 w-5 mr-2 text-primary" />
                  Escanear Productos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <ProductoEscanerSeguroV2 
                    onEscaneo={handleEscaneo}
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
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : productosControlados.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-gray-400" />
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
                    {productosControlados.map((producto) => (
                      <div 
                        key={producto.codigo}
                        className={`p-3 rounded-md border mb-2 ${
                          producto.estado === 'correcto' 
                            ? "bg-green-100 border-green-300 text-green-800" 
                            : producto.estado === 'excedente' 
                              ? "bg-red-100 border-red-300 text-red-800"
                              : producto.estado === 'faltante'
                                ? "bg-yellow-100 border-yellow-300 text-yellow-800"
                                : "bg-gray-100 border-gray-300 text-gray-800"
                        }`}
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
                              {producto.estado === 'correcto' ? "Completo" : 
                               producto.estado === 'excedente' ? "Excedente" : 
                               producto.estado === 'faltante' ? "Faltante" : "Pendiente"}
                            </div>
                          </div>
                        </div>
                      </div>
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
// Extender Window para incluir dataPedido
declare global {
  interface Window {
    dataPedido: any;
  }
}

import { useEffect, useState, useRef } from "react";
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
  Timer, 
  Barcode, 
  Plus, 
  Minus, 
  Check, 
  AlertTriangle, 
  StopCircle,
  ClipboardList,
  Eye
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
import { ProductoEscanerSeguro } from "@/components/control/producto-escaner-seguro";
import { ControlFinalizarDialog } from "@/components/control/control-finalizar-dialog";
import { CodigoNoEncontradoAlert } from "@/components/control/codigo-no-encontrado-alert";
import { CodigosRegistradosList } from "@/components/control/codigos-registrados-list-new";
import { ProductosEscaneadosLista } from "@/components/control/productos-escaneados-lista";
import { ProductoExcedenteAlert } from "@/components/control/producto-excedente-alert";
import { RetirarExcedenteAlert } from "@/components/control/retirar-excedente-alert";
import { ControlFinalizadoDialog } from "@/components/control/control-finalizado-dialog";
import PedidoProductosModal from "@/components/control/pedido-productos-modal";
import PausaControlModal from "@/components/control/pausa-control-modal";

export default function ControlPedidoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [matched, params] = useRoute("/control/pedido/:id");
  const pedidoId = matched && params?.id ? parseInt(params.id) : null;
  
  // Mutation para pausar control
  const pausarControlMutation = useMutation({
    mutationFn: async (datos: { pedidoId: number, motivo: string }) => {
      console.log("Intentando pausar control para pedido:", datos.pedidoId, "con motivo:", datos.motivo);
      const res = await apiRequest("POST", "/api/pausas", {
        ...datos,
        tipo: "control" // Especificar que es una pausa de control
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al pausar el control");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      console.log("Pausa de control creada correctamente:", data);
      setPausaActiva(true);
      setPausaActualId(data.id);
      toast({
        title: "Control pausado",
        description: "El control del pedido ha sido pausado",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/pedidos/${pedidoId}`] });
    },
    onError: (error: Error) => {
      console.error("Error al pausar control:", error);
      toast({
        title: "Error al pausar control",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation para reanudar control
  const reanudarControlMutation = useMutation({
    mutationFn: async () => {
      if (!pausaActualId) {
        throw new Error("No hay pausa activa para reanudar");
      }
      console.log("Intentando reanudar pausa con ID:", pausaActualId);
      const res = await apiRequest("PUT", `/api/pausas/${pausaActualId}/fin`, {});
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al reanudar el control");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      console.log("Control reanudado correctamente:", data);
      setPausaActiva(false);
      setPausaActualId(null);
      toast({
        title: "Control reanudado",
        description: "El control del pedido ha sido reanudado",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/pedidos/${pedidoId}`] });
    },
    onError: (error: Error) => {
      console.error("Error al reanudar control:", error);
      toast({
        title: "Error al reanudar control",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Referencias
  const escanerInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para los diálogos
  const [alertOpen, setAlertOpen] = useState(false);
  const [excedenteAlertOpen, setExcedenteAlertOpen] = useState(false);
  const [retirarExcedenteOpen, setRetirarExcedenteOpen] = useState(false);
  const [finalizadoOpen, setFinalizadoOpen] = useState(false);
  const [detalleModalOpen, setDetalleModalOpen] = useState(false);
  const [pausaModalOpen, setPausaModalOpen] = useState(false);
  const [cargandoControl, setCargandoControl] = useState(false);
  const [pausaActiva, setPausaActiva] = useState(false);
  const [pausaActualId, setPausaActualId] = useState<number | null>(null);
  const [codigoNoEncontrado, setCodigoNoEncontrado] = useState({
    codigo: "",
    descripcion: ""
  });
  const [productoExcedente, setProductoExcedente] = useState({
    codigo: "",
    descripcion: "",
    cantidadEsperada: 0,
    cantidadActual: 0
  });
  const [productosExcedentes, setProductosExcedentes] = useState<Array<{
    codigo: string;
    descripcion: string;
    cantidadExcedente: number;
  }>>([]);
  
  // Estado del control
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
  
  // Reiniciar el estado del control al montar/desmontar el componente
  useEffect(() => {
    // Limpiar estado al desmontar
    return () => {
      console.log("Limpiando estado del control");
      setCargandoControl(false);
      setControlState({
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
    };
  }, []);
  
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
  
  // Cargar datos del armador si existe (usando la nueva ruta pública)
  const { 
    data: armador,
    isLoading: isLoadingArmador 
  } = useQuery<User>({
    queryKey: ["/api/users/info", pedido?.armadorId],
    queryFn: async () => {
      if (!pedido?.armadorId) throw new Error("No hay armador asignado");
      const res = await apiRequest("GET", `/api/users/${pedido.armadorId}/info`);
      if (!res.ok) throw new Error("No se pudo obtener información del armador");
      return res.json();
    },
    enabled: !!pedido?.armadorId,
    retry: false
  });

  // Consulta para cargar un control activo si existe
  const { 
    isLoading: isLoadingControlActivo,
    refetch: refetchControlActivo,
    data: controlActivoData
  } = useQuery({
    queryKey: ["/api/control/pedidos", pedidoId, "activo"],
    // IMPORTANTE: Siempre refrescar los datos para mantener sincronización
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Refrescar cada 5 segundos para garantizar datos actualizados
    refetchOnReconnect: false,
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/control/pedidos/${pedidoId}/activo`);
        const data = await res.json();
        console.log("Control activo encontrado:", data);
        
        // Inicializar estado del control con los datos cargados
        setControlState({
          isRunning: true,
          startTime: new Date(data.control.fecha).getTime(),
          pedidoId: pedidoId,
          pedidoYaControlado: false,
          mensajeError: null,
          codigoPedido: data.pedido?.pedidoId || null,
          productosControlados: data.productos.map((p: any) => {
            // Encontrar si hay detalles de control para este producto
            const controlDetalles = data.detalles.filter((d: any) => 
              areCodesEquivalent(d.codigo, p.codigo, data.pedido?.pedidoId || "")
            );
            
            // Calcular cantidad controlada sumando todos los escaneos
            const cantidadControlada = controlDetalles.reduce((acc: number, d: any) => 
              acc + (d.cantidad || 0), 0
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
              descripcion: p.descripcion,
              ubicacion: p.ubicacion || "",
              estado: estado
            };
          }),
          historialEscaneos: data.detalles.map((d: any) => {
            // Buscar el producto asociado para obtener descripción completa
            const producto = data.productos.find((p: any) => p.id === d.productoId);
            return {
              id: d.id,
              codigo: d.codigo,
              cantidad: d.cantidadEsperada || 0,
              controlado: d.cantidadControlada || 0,
              timestamp: new Date(d.timestamp || data.control.fecha),
              escaneado: true,
              descripcion: producto?.descripcion || d.descripcion || "Sin descripción",
              ubicacion: producto?.ubicacion || d.ubicacion || "",
              estado: d.estado || "correcto"
            };
          }) || [],
          segundos: Math.floor((Date.now() - new Date(data.control.fecha).getTime()) / 1000)
        });
        
        // Focus en el input de escaneo
        setTimeout(() => {
          if (escanerInputRef.current) {
            escanerInputRef.current.focus();
          }
        }, 100);
        
        return data;
      } catch (error) {
        console.log("No hay control activo para este pedido o ocurrió un error:", error);
        return null;
      }
    },
    enabled: !!pedidoId && pedido?.estado === 'controlando',
    retry: false
  });
  
  // Dialog de finalización
  const [finalizarOpen, setFinalizarOpen] = useState(false);
  const [comentarios, setComentarios] = useState("");
  
  // Ya tenemos la query de información del armador arriba
  
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
      
      try {
        // Iniciamos o continuamos el control
        console.log("Iniciando/continuando control para pedido", pedidoId);
        console.log("Enviando solicitud para iniciar control...");
        const res = await fetch(`/api/control/pedidos/${pedidoId}/iniciar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({})
        });
        
        console.log("Respuesta recibida, status:", res.status);
        
        // Manejo mejorado de errores
        if (!res.ok) {
          // Intentamos obtener el error como JSON primero
          let errorMessage = "Error al iniciar control";
          let errorData;
          
          const contentType = res.headers.get("content-type");
          console.log("Tipo de contenido de la respuesta:", contentType);
          
          if (contentType && contentType.includes("application/json")) {
            try {
              errorData = await res.json();
              console.log("Datos de error:", errorData);
              errorMessage = errorData.message || errorMessage;
              
              // Verificar si es un error de pedido ya controlado
              if (errorData.message && errorData.message.includes("ya fue controlado")) {
                // Lanzar un error específico para pedidos ya controlados
                throw new Error(`PEDIDO_YA_CONTROLADO: ${errorData.message}`);
              }
            } catch (jsonError) {
              console.error("Error al procesar JSON de error:", jsonError);
              if (jsonError instanceof Error && jsonError.message.startsWith("PEDIDO_YA_CONTROLADO:")) {
                throw jsonError; // Re-lanzar nuestro error especial
              }
            }
          } else {
            // No es JSON, obtener como texto
            try {
              const errorText = await res.text();
              console.error("Respuesta de error (texto):", errorText);
              // Mensaje más descriptivo con código de estado
              errorMessage = `Error ${res.status} al iniciar control`;
              // Solo usar los primeros 100 caracteres para no sobrecargar
              if (errorText && errorText.length > 0) {
                if (errorText.includes("<")) {
                  // Probable HTML, no incluirlo en el mensaje
                  errorMessage += ": El servidor respondió con HTML en lugar de JSON";
                } else {
                  errorMessage += `: ${errorText.substring(0, 100)}${errorText.length > 100 ? '...' : ''}`;
                }
              }
            } catch (textError) {
              console.error("No se pudo obtener el texto del error:", textError);
            }
          }
          
          throw new Error(errorMessage);
        }
        
        // Devolvemos los datos del control y los productos actualizados
        const controlData = await res.json();
        console.log("Datos del control:", controlData);
        
        // Verificar si se está continuando un control existente
        const esContinuacion = controlData.message && controlData.message.includes("Continuando control");
        
        if (esContinuacion) {
          console.log("Continuando un control existente con datos:", controlData);
        }
        
        return controlData;
      } catch (error) {
        console.error("Error en iniciarControlMutation:", error);
        
        // Verificar si es un error específico de pedido ya controlado
        if (error instanceof Error && error.message.startsWith("PEDIDO_YA_CONTROLADO:")) {
          // Extraer el mensaje real del error
          const realMessage = error.message.replace("PEDIDO_YA_CONTROLADO: ", "");
          
          // Retornar un objeto especial para manejar este caso
          return { 
            pedidoYaControlado: true, 
            mensaje: realMessage 
          };
        }
        
        throw error;
      }
    },
    onSuccess: (data: any) => {
      // Verificar si es un pedido ya controlado
      if (data.pedidoYaControlado) {
        console.log("Pedido ya controlado:", data.mensaje);
        
        toast({
          title: "Pedido ya controlado",
          description: data.mensaje,
          variant: "destructive",
          duration: 8000 // Mostrar por más tiempo para asegurar que el usuario lo vea
        });
        
        // Actualizar el estado para mostrar mensaje de pedido ya controlado
        setControlState(prevState => ({
          ...prevState,
          isRunning: false,
          pedidoId: pedidoId,
          pedidoYaControlado: true,
          mensajeError: data.mensaje
        }));
        
        return; // No continuar con el proceso normal
      }
      
      toast({
        title: "Control iniciado",
        description: "El control del pedido ha sido iniciado correctamente",
      });
      
      // Mostramos información de depuración sobre los productos cargados
      console.log("PRODUCTOS CARGADOS:", data.productos?.length || 0);
      
      // Obtenemos los productos de la respuesta
      const productosParaControl = data.productos || productos;
      
      // Verificar si hay productos
      if (!productosParaControl || productosParaControl.length === 0) {
        console.error("⚠️ ERROR: No hay productos disponibles para este pedido");
        toast({
          title: "Error de datos",
          description: "No se encontraron productos para este pedido",
          variant: "destructive"
        });
      } else {
        console.log(`✓ ${productosParaControl.length} productos cargados correctamente`);
      }
      
      // Verificar si se está continuando un control
      const esContinuacion = data.message && data.message.includes("Continuando control");
      const detallesControl = data.detallesControl || [];
      
      // Escaneos previos si estamos continuando un control
      const escaneosPrevios = detallesControl.map((detalle: any) => {
        return {
          id: detalle.productoId,
          codigo: detalle.codigo,
          cantidad: detalle.cantidadEsperada,
          controlado: detalle.cantidadControlada,
          descripcion: detalle.producto?.descripcion || "",
          timestamp: new Date(detalle.timestamp),
          escaneado: true,
          ubicacion: detalle.producto?.ubicacion || "",
          estado: detalle.estado
        };
      });
      
      if (esContinuacion) {
        console.log(`Continuando control con ${detallesControl.length} productos ya escaneados`);
      }
      
      // Preparar productos controlados
      const productosControlados = productosParaControl.map((p: any) => {
        console.log(`Producto con código ${p.codigo} agregado al estado, cantidad esperada: ${p.cantidad}`);
        
        // Buscar si ya está controlado (en caso de continuación)
        const detalleExistente = detallesControl.find((d: any) => 
          d.codigo === p.codigo || d.productoId === p.id
        );
        
        // Asegurar que cantidadControlada sea un número válido
        const cantidadControlada = detalleExistente && typeof detalleExistente.cantidadControlada === 'number' 
          ? detalleExistente.cantidadControlada 
          : 0;
        
        // Determinar estado basado en la cantidad
        let estado: ControlEstado = "pendiente";
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
          // Asegurarnos de que el código siempre sea un string (para evitar problemas de tipo)
          codigo: p.codigo ? String(p.codigo).trim() : "",
          cantidad: p.cantidad,
          controlado: cantidadControlada,
          descripcion: p.descripcion,
          ubicacion: p.ubicacion || "",
          estado: estado
        };
      });
      
      // Inicializar estado del control con los productos actualizados
      setControlState({
        isRunning: true,
        startTime: Date.now(),
        pedidoId: pedidoId,
        pedidoYaControlado: false,
        mensajeError: null,
        codigoPedido: data.pedido?.pedidoId || null,
        productosControlados: productosControlados,
        historialEscaneos: esContinuacion ? escaneosPrevios : [],
        segundos: 0
      });
      
      // Detectar si hay excedentes y mostrar diálogo automáticamente
      const productosConExcedentes = productosControlados.filter(p => p.controlado > p.cantidad);
      console.log("Productos con excedentes detectados:", productosConExcedentes);
      
      if (productosControlados.length > 0 && productosConExcedentes.length > 0) {
        console.log("Se detectaron productos con excedentes automáticamente!");
        
        // Verificar si solo hay excedentes (no faltan productos)
        const hayFaltantes = productosControlados.some(p => p.controlado < p.cantidad);
        
        if (!hayFaltantes) {
          console.log("SOLO FALTAN EXCEDENTES - Mostrando diálogo para confirmar retirada");
          
          // Preparar lista de productos excedentes
          const excedentes = productosConExcedentes.map(p => ({
            codigo: p.codigo,
            descripcion: p.descripcion || "",
            cantidadExcedente: p.controlado - p.cantidad
          }));
          
          setProductosExcedentes(excedentes);
          
          // Mostrar automáticamente el diálogo para retirar excedentes
          setTimeout(() => {
            setRetirarExcedenteOpen(true);
          }, 500);
        } else {
          // Si hay faltantes, solo mostramos un aviso
          toast({
            title: "Excedentes detectados",
            description: "Se han detectado productos con cantidades excedentes. Serán notificados al finalizar el control.",
            duration: 5000
          });
        }
      }
      
      // Verificamos especialmente el pedido P0025
      if (data.pedido?.pedidoId === 'P0025' || pedidoId === 23) {
        console.log("⚠️ PEDIDO ESPECIAL P0025 DETECTADO");
        console.log("Verificando códigos críticos:");
        console.log("- Código 17061 presente:", productosParaControl.some((p: any) => String(p.codigo).includes('17061')));
        console.log("- Código 18001 presente:", productosParaControl.some((p: any) => String(p.codigo).includes('18001')));
      }
      
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
      console.error("Error al iniciar control:", error);
    },
  });
  
  // Escanear producto mutation
  const escanearProductoMutation = useMutation({
    mutationFn: async ({ codigo, cantidad }: { codigo: string, cantidad: number }) => {
      if (!pedidoId) throw new Error("ID de pedido no válido");
      
      try {
        console.log(`Enviando escaneo: código=${codigo}, cantidad=${cantidad}, pedidoId=${pedidoId}`);
        
        // Usar fetch directamente para tener más control sobre el manejo de errores
        const res = await fetch(`/api/control/pedidos/${pedidoId}/escanear`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            codigo,
            cantidad
          })
        });
        
        // Manejo mejorado de errores
        if (!res.ok) {
          // Intentamos obtener el error como JSON primero
          let errorMessage = "Error al escanear producto";
          let errorData: any = {};
          
          // Verificar si la respuesta es JSON
          const contentType = res.headers.get("content-type");
          
          if (contentType && contentType.includes("application/json")) {
            try {
              errorData = await res.json();
              console.log("Datos de error:", errorData);
              errorMessage = errorData.message || errorMessage;
            } catch (jsonError) {
              console.error("Error al procesar JSON de error:", jsonError);
            }
          } else {
            // No es JSON, obtener como texto
            try {
              const errorText = await res.text();
              console.log("Respuesta de error (texto):", errorText);
              if (errorText && errorText.length > 0) {
                if (errorText.includes("<")) {
                  // Probable HTML, no incluirlo en el mensaje
                  errorMessage = `${errorMessage}: El servidor respondió con HTML en lugar de JSON`;
                } else {
                  errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}${errorText.length > 100 ? '...' : ''}`;
                }
              }
            } catch (textError) {
              console.error("No se pudo obtener el texto del error:", textError);
            }
          }
          
          // En caso de 404, asumimos que el código no existe en este pedido
          if (res.status === 404) {
            errorData.tipo = 'CODIGO_NO_ENCONTRADO';
          }
          
          // Añadir información adicional para depuración
          const errorWithData = new Error(errorMessage);
          (errorWithData as any).data = errorData;
          (errorWithData as any).codigo = codigo;
          throw errorWithData;
        }
        
        // Procesar la respuesta exitosa
        try {
          const data = await res.json();
          return data;
        } catch (jsonError) {
          console.error("Error al procesar respuesta JSON exitosa:", jsonError);
          throw new Error("Error al procesar la respuesta del servidor");
        }
      } catch (error) {
        console.error("Error en escanearProductoMutation:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log(`RESPUESTA DEL SERVIDOR - Código: ${data.producto.codigo}, Cantidad total: ${data.cantidadTotalControlada}`);
      
      // Después de un escaneo exitoso, siempre refrescar la consulta completa
      // para obtener datos actualizados de la base de datos
      refetchControlActivo().then(refreshResult => {
        if (refreshResult.data) {
          console.log("Datos de control actualizados después del escaneo");

          // También actualizamos directamente el estado con los datos del escaneo actual
          // para garantizar una UI reactiva y consistente
          setControlState(prev => {
            // Actualizamos solo el producto que acabamos de escanear
            const productosActualizados = prev.productosControlados.map(p => {
              if (p.codigo === data.producto.codigo) {
                // IMPORTANTE: Usar la cantidad total del servidor
                const nuevaCantidad = data.cantidadTotalControlada || 0;
                
                // Determinar estado basado en la nueva cantidad
                let nuevoEstado: any = "pendiente";
                if (nuevaCantidad === 0) {
                  nuevoEstado = "pendiente";
                } else if (nuevaCantidad < p.cantidad) {
                  nuevoEstado = "faltante";
                } else if (nuevaCantidad === p.cantidad) {
                  nuevoEstado = "correcto";
                } else {
                  nuevoEstado = "excedente";
                }
                
                console.log(`Producto directo ${p.codigo}: actualizado de ${p.controlado} a ${nuevaCantidad} (${nuevoEstado})`);
                
                return {
                  ...p,
                  controlado: nuevaCantidad,
                  estado: nuevoEstado
                };
              }
              return p;
            });
            
            // Crear nuevo escaneo para el historial
            const nuevoEscaneo: ProductoControlado & { timestamp: Date, escaneado: boolean } = {
              id: data.detalle?.id || 0,
              codigo: data.producto?.codigo || "",
              cantidad: data.producto?.cantidad || 0,
              controlado: data.cantidadTotalControlada || 0,
              descripcion: data.producto?.descripcion || "",
              timestamp: new Date(),
              escaneado: true,
              ubicacion: data.producto?.ubicacion || "",
              estado: data.controlEstado || "pendiente"
            };
            
            // Verificar excedentes y mostrar alerta si es necesario
            if (data.controlEstado === 'excedente' || data.tipo === 'excedente') {
              const productoEncontrado = productosActualizados.find(p => p.codigo === data.producto.codigo);
              
              setProductoExcedente({
                codigo: data.producto?.codigo || "",
                descripcion: productoEncontrado?.descripcion || data.producto?.descripcion || "",
                cantidadEsperada: data.producto?.cantidad || 0,
                cantidadActual: data.cantidadTotalControlada || 0
              });
              setExcedenteAlertOpen(true);
            }
            
            return {
              ...prev,
              productosControlados: productosActualizados,
              historialEscaneos: [...prev.historialEscaneos, nuevoEscaneo]
            };
          });
        }
      });
      
      // Sonido de éxito o alertas
      if (data.controlEstado === 'correcto') {
        try {
          const audio = new Audio('/sounds/success.mp3');
          audio.play();
        } catch (e) {
          console.log('Error reproduciendo sonido:', e);
        }
      } else if (data.controlEstado === 'excedente' || data.controlEstado === 'faltante') {
        try {
          const audio = new Audio('/sounds/alert.mp3');
          audio.play();
        } catch (e) {
          console.log('Error reproduciendo sonido:', e);
        }
      }
      
      // Mostrar mensaje de éxito con verificación de null
      toast({
        title: "Producto registrado",
        description: `Código ${data.producto?.codigo || "[sin código]"} registrado correctamente`,
      });
      
      // No forzar una actualización completa que podría sobreescribir datos
      // En su lugar solo actualizamos el pedido base
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos", pedidoId] });

      // Verificar si todos los productos están correctamente controlados para finalización automática
      setControlState(prevState => {
        // Verificar si todos los productos están controlados correctamente o han sido ajustados
        const todosProductosControlados = prevState.productosControlados.every(p => 
          p.estado === 'correcto' || 
          (p.controlado === p.cantidad && p.estado !== 'pendiente')
        );
        
        const todosProductosRegistrados = prevState.productosControlados.every(p => 
          p.controlado !== 0
        );

        if (todosProductosControlados && todosProductosRegistrados) {
          console.log("¡Todos los productos están controlados correctamente! Verificando excedentes...");
          
          // Verificar si hay excedentes que necesitan ser retirados
          const hayExcedentes = prevState.productosControlados.some(p => p.controlado > p.cantidad);
          
          if (hayExcedentes) {
            console.log("Hay excedentes que retirar antes de finalizar automáticamente");
            // Mostrar el diálogo de excedentes para que el usuario confirme que los ha retirado
            setTimeout(() => verificarExcedentesParaRetirar(), 1000);
          } else {
            console.log("No hay excedentes, mostrando confirmación de finalización");
            // No hay excedentes, mostramos el diálogo de finalización exitosa
            setTimeout(() => {
              try {
                // Reproducir sonido de éxito
                const audio = new Audio('/sounds/success.mp3');
                audio.play();
              } catch (e) {
                console.log('Error reproduciendo sonido:', e);
              }
              
              // Mostrar diálogo de finalización exitosa
              setFinalizadoOpen(true);
              
              // Finalizar automáticamente el control en segundo plano
              finalizarControlMutation.mutate({ 
                resultado: 'completo' as any,
                comentarios: "Finalización automática - Todos los productos controlados correctamente" 
              });
            }, 500);
          }
        }
        
        return prevState; // No necesitamos actualizar el estado aquí
      });
    },
    onError: (error: Error) => {
      console.error("Error completo al escanear:", error);
      
      // Verificar si es un error de código no encontrado
      const errorData = (error as any).data || {};
      const codigo = (error as any).codigo || "";
      
      if (errorData.tipo === 'CODIGO_NO_ENCONTRADO') {
        // Mostrar alerta específica de código no encontrado
        setCodigoNoEncontrado({
          codigo: codigo,
          descripcion: errorData.message || "Código no encontrado en este pedido"
        });
        setAlertOpen(true);
        
        // Sonido de error
        try {
          const audio = new Audio('/sounds/error.mp3');
          audio.play();
        } catch (e) {
          console.log('Error reproduciendo sonido:', e);
        }
      } else {
        // Mensaje de error genérico
        toast({
          title: "Error al registrar producto",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });
  
  // Finalizar control mutation
  const finalizarControlMutation = useMutation({
    mutationFn: async ({ resultado, comentarios }: { resultado: ControlEstado, comentarios?: string }) => {
      if (!pedidoId) throw new Error("ID de pedido no válido");
      
      try {
        // Enviamos la solicitud para finalizar el control
        const res = await apiRequest("POST", `/api/control/pedidos/${pedidoId}/finalizar`, {
          resultado,
          comentarios
        });
        
        // Manejo mejorado de errores
        if (!res.ok) {
          let errorMessage = "Error al finalizar control";
          try {
            const errorData = await res.json();
            errorMessage = errorData.message || errorMessage;
          } catch (e) {
            try {
              const errorText = await res.text();
              if (errorText && errorText.length > 0) {
                errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}...`;
              }
            } catch (textError) {
              console.error("No se pudo obtener el texto del error:", textError);
            }
          }
          throw new Error(errorMessage);
        }
        
        return await res.json();
      } catch (error) {
        console.error("Error en finalizarControlMutation:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Detener el control
      setControlState(prev => ({
        ...prev,
        isRunning: false
      }));
      
      // Cerrar el dialog de finalización
      setFinalizarOpen(false);
      
      // Actualizar datos del pedido
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos", pedidoId] });
      
      // Mostrar el diálogo de control finalizado con éxito
      setFinalizadoOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar control",
        description: error.message,
        variant: "destructive",
      });
      console.error("Error al finalizar control:", error);
    },
  });
  
  // Mutación para crear pausa de control
  const crearPausaMutation = useMutation({
    mutationFn: async (pausaData: { pedidoId: number, motivo: string }) => {
      const res = await apiRequest("POST", "/api/pausas", {
        ...pausaData,
        tipo: "control" // Indicar que es una pausa de control
      });
      
      if (!res.ok) {
        let errorMessage = "Error al crear pausa de control";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          const errorText = await res.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Control pausado",
        description: "El control se ha pausado correctamente",
      });
      
      // Guardar ID de la pausa activa
      setPausaActiva(true);
      setPausaActualId(data.id);
      
      // Actualizar datos
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos", pedidoId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al pausar control",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutación para finalizar pausa de control
  const finalizarPausaMutation = useMutation({
    mutationFn: async (pausaId: number) => {
      const res = await apiRequest("PUT", `/api/pausas/${pausaId}/fin`, {});
      
      if (!res.ok) {
        let errorMessage = "Error al finalizar pausa";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          const errorText = await res.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Control reanudado",
        description: "El control se ha reanudado correctamente",
      });
      
      // Resetear estado de pausa
      setPausaActiva(false);
      setPausaActualId(null);
      
      // NO invalidar las consultas para evitar que se pierdan los datos actuales
      // En su lugar, solo actualizamos el estado del pedido
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos", pedidoId] });
      
      // Registrar que el control ha sido reanudado correctamente
      console.log("Control reanudado correctamente. Manteniendo datos actuales de control");
      
      // Actualizar el tiempo de inicio para que continue correctamente
      setControlState(prevState => ({
        ...prevState,
        isRunning: true,
        // Ajustar el startTime para mantener el tiempo transcurrido
        startTime: Date.now() - (prevState.segundos * 1000)
      }));
    },
    onError: (error: Error) => {
      toast({
        title: "Error al reanudar control",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Cancelar control mutation
  const cancelarControlMutation = useMutation({
    mutationFn: async ({ comentarios }: { comentarios?: string }) => {
      if (!pedidoId) throw new Error("ID de pedido no válido");
      
      try {
        const res = await apiRequest("POST", `/api/control/pedidos/${pedidoId}/cancelar`, {
          comentarios
        });
        
        if (!res.ok) {
          let errorMessage = "Error al cancelar control";
          try {
            const errorData = await res.json();
            errorMessage = errorData.message || errorMessage;
          } catch (e) {
            const errorText = await res.text();
            errorMessage = `${errorMessage}: ${errorText}`;
          }
          throw new Error(errorMessage);
        }
        
        return await res.json();
      } catch (error) {
        console.error("Error en cancelarControlMutation:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Control cancelado",
        description: "El control del pedido ha sido cancelado",
      });
      
      // Detener el control
      setControlState(prev => ({
        ...prev,
        isRunning: false
      }));
      
      // Actualizar datos del pedido
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos", pedidoId] });
      
      // Redireccionar a la lista de controles después de 1 segundo
      setTimeout(() => {
        setLocation("/control");
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cancelar control",
        description: error.message,
        variant: "destructive",
      });
      console.error("Error al cancelar control:", error);
    },
  });
  
  // Función para manejar el escaneo de productos con mejor manejo de errores
  const handleEscanearProducto = (codigo: string, cantidad: number = 1) => {
    if (!codigo) {
      console.error("⚠️ Código vacío o inválido");
      return;
    }
    
    try {
      // Normalizar código para consistencia
      const codigoNormalizado = typeof codigo === 'string' ? 
        codigo.trim() : String(codigo).trim();
      
      if (codigoNormalizado === "") {
        console.error("⚠️ Código vacío después de normalización");
        return;
      }
      
      console.log(`Escaneando producto: código="${codigoNormalizado}", cantidad=${cantidad}`);
      
      // Usar try-catch para evitar que errores del plugin interrumpan la operación
      try {
        escanearProductoMutation.mutate({ 
          codigo: codigoNormalizado, 
          cantidad: cantidad > 0 ? cantidad : 1 
        });
      } catch (error) {
        // Capturar explícitamente errores para evitar que el plugin los intercepte
        console.error("Error controlado durante escaneo:", error);
        toast({
          title: "Error al procesar escaneo",
          description: error instanceof Error ? error.message : "Error inesperado",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error general en handleEscanearProducto:", error);
      // Mostrar notificación al usuario
      toast({
        title: "Error al procesar código",
        description: "Se produjo un error al procesar el código escaneado",
        variant: "destructive"
      });
    }
  };
  
  // Función para iniciar control
  const handleIniciarControl = () => {
    setCargandoControl(true);
    iniciarControlMutation.mutate();
  };
  
  // Función para verificar excedentes que deben ser retirados
  const verificarExcedentesParaRetirar = () => {
    // Buscar productos con cantidades excedentes
    const excedentes = controlState.productosControlados
      .filter(p => p.controlado > p.cantidad)
      .map(p => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        cantidadExcedente: p.controlado - p.cantidad
      }));
    
    // Si hay excedentes, mostrar alerta
    if (excedentes.length > 0) {
      setProductosExcedentes(excedentes);
      setRetirarExcedenteOpen(true);
      return true;
    }
    
    return false;
  };
  
  // Función para finalizar control
  const handleFinalizarControl = (resultado: string) => {
    console.log("Finalizando control con resultado:", resultado);
    
    // Si la finalización es correcta o se seleccionó "excedentes", verificar si hay excedentes
    if ((resultado === 'completo' || resultado === 'excedentes') && !hasFaltantes) {
      // Verificar si hay productos con cantidades excedentes
      const hayExcedentes = controlState.productosControlados.some(p => p.controlado > p.cantidad);
      
      console.log("¿Hay excedentes?", hayExcedentes);
      
      if (hayExcedentes) {
        // Mostrar diálogo para confirmar retiro de excedentes
        verificarExcedentesParaRetirar();
        return;
      }
    }
    
    // Si no hay excedentes o si se está finalizando con faltantes, continuar normalmente
    finalizarControlMutation.mutate({ 
      resultado: resultado as any, // Usar typecast para evitar error de tipo
      comentarios 
    });
  };
  
  // Función para completar finalización después de retirar excedentes
  const completarFinalizacion = () => {
    console.log("Completando finalización después de retirar excedentes");
    
    try {
      // Primero cerrar el diálogo de excedentes
      setRetirarExcedenteOpen(false);
      
      // Mostrar mensaje de confirmación
      toast({
        title: "Excedentes confirmados",
        description: "Se ha confirmado que los excedentes han sido retirados del pedido",
        variant: "default",
      });
      
      // Pequeña pausa antes de iniciar el proceso de finalización
      setTimeout(() => {
        // Verificar si todos los productos están en cantidad correcta después de retirar excedentes
        const todosProductosCorrectos = controlState.productosControlados.every(p => {
          // Asumimos que después de retirar excedentes, las cantidades son correctas
          // Es decir, controlado === cantidad para todos los productos
          return p.controlado === p.cantidad;
        });
        
        console.log("¿Todos los productos están correctos después de retirar excedentes?", todosProductosCorrectos);
        
        if (todosProductosCorrectos) {
          // Mostrar alerta de finalización
          toast({
            title: "Control Completado",
            description: "¡Todos los productos han sido controlados correctamente! Finalizando control...",
            variant: "default",
          });
        }
        
        try {
          // Finalizar el control con estado completo
          finalizarControlMutation.mutate({
            resultado: 'completo' as any, // Tipo temporal para resolver error
            comentarios: (comentarios ? comentarios + ' - ' : '') + 'Excedentes retirados correctamente'
          });
        } catch (error) {
          console.error("Error al ejecutar finalización del control:", error);
          toast({
            title: "Error al finalizar",
            description: "Ocurrió un error al finalizar el control.",
            variant: "destructive"
          });
        }
      }, 500);
    } catch (error) {
      console.error("Error en completarFinalizacion:", error);
      toast({
        title: "Error",
        description: "Se produjo un error inesperado al procesar la finalización.",
        variant: "destructive"
      });
    }
  };
  
  // Función para cancelar un control
  const handleCancelarControl = () => {
    if (window.confirm("¿Está seguro que desea cancelar este control?")) {
      cancelarControlMutation.mutate({ comentarios });
    }
  };
  
  // Verificar si hay productos faltantes
  const hasFaltantes = controlState.productosControlados.some(p => 
    p.controlado < p.cantidad
  );
  
  // Actualizar temporizador cada segundo
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
    if (pedido && productos.length > 0 && !controlState.isRunning && 
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

  // Exponer los datos del pedido para debugging en la consola
  useEffect(() => {
    if (pedido && typeof window !== 'undefined') {
      window.dataPedido = {
        pedido,
        productos,
        controlState
      };
      console.log("Datos del pedido disponibles en window.dataPedido");

      // Agregar un manejador de errores global para evitar que el plugin de errores de runtime interrumpa la operación
      window.onerror = function(message, source, lineno, colno, error) {
        console.error("Error capturado globalmente:", { message, source, lineno, colno });
        console.error("Detalles del error:", error);
        
        // Prevenir que el plugin de runtime error de Replit muestre el modal
        if (source && source.includes("runtime-error-plugin")) {
          console.warn("Suprimiendo error del plugin runtime-error-plugin");
          return true; // Prevenir manejo por defecto
        }
        
        return false; // Permitir manejo normal para otros errores
      };
    }
    
    // Limpiar el manejador de errores al desmontar
    return () => {
      if (typeof window !== 'undefined') {
        window.onerror = null;
      }
    };
  }, [pedido, productos, controlState]);
  
  // Extraer horas, minutos y segundos del temporizador
  const horas = Math.floor(controlState.segundos / 3600);
  const minutos = Math.floor((controlState.segundos % 3600) / 60);
  const segundos = controlState.segundos % 60;
  
  // Manejar estado de carga
  const isLoading = isLoadingPedido || iniciarControlMutation.isPending || cargandoControl;
  
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
          
          {/* El tiempo transcurrido se ha ocultado según requerimiento */}
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
                    onClick={() => {
                      console.log("Abriendo modal de detalle para pedido ID:", pedidoId);
                      setDetalleModalOpen(true);
                    }}
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
                  <p><span className="font-semibold">Cliente:</span> {pedido.clienteId}</p>
                  <p><span className="font-semibold">Fecha:</span> {formatDate(pedido.fecha)}</p>

                </div>
                <div>
                  <p><span className="font-semibold">Vendedor:</span> {pedido.vendedor}</p>
                  <p><span className="font-semibold">Armador:</span> {armador ? (armador.firstName || armador.username) : isLoadingArmador ? "Cargando..." : "No asignado"}</p>

                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              {!controlState.isRunning && !controlState.pedidoYaControlado && (
                <Button onClick={handleIniciarControl} disabled={isLoading}>
                  {isLoading ? 'Cargando...' : pedido.estado === 'controlando' ? 'Continuar Control' : 'Iniciar Control'}
                </Button>
              )}
              
              {controlState.isRunning && (
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={handleCancelarControl}>
                    Cancelar Control
                  </Button>
                  
                  {/* Botón de Pausar o Reanudar control */}
                  {pausaActiva ? (
                    <Button 
                      variant="outline" 
                      onClick={() => reanudarControlMutation.mutate()}
                      disabled={reanudarControlMutation.isPending}
                    >
                      {reanudarControlMutation.isPending ? 'Reanudando...' : 'Reanudar Control'}
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={() => setPausaModalOpen(true)}
                      disabled={pausarControlMutation.isPending}
                    >
                      {pausarControlMutation.isPending ? 'Procesando...' : 'Pausar Control'}
                    </Button>
                  )}
                  
                  <Button onClick={() => setFinalizarOpen(true)}>
                    Finalizar Control
                  </Button>
                </div>
              )}
              
              {controlState.pedidoYaControlado && (
                <div className="text-red-500 font-medium">
                  {controlState.mensajeError || "Este pedido ya fue controlado."}
                </div>
              )}
            </CardFooter>
          </Card>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : pedidoError ? (
          <Card className="mb-6 border-red-200">
            <CardHeader>
              <CardTitle className="text-red-500">Error al cargar pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{pedidoError instanceof Error ? pedidoError.message : "Error desconocido"}</p>
            </CardContent>
          </Card>
        ) : null}
        
        {/* Área de control activo */}
        {controlState.isRunning && (
          <div className="mb-6 space-y-6">
            {/* Escáner de productos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Barcode className="h-5 w-5" />
                  Escanear Productos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Nuevo componente más seguro para evitar errores del plugin */}
                <ProductoEscanerSeguro
                  pedidoId={pedidoId}
                  onEscaneoExitoso={(data) => {
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
                      
                      // Obtener datos del producto
                      const productoEncontrado = prev.productosControlados.find(p => p.codigo === data.producto.codigo);
                      
                      // Crear nuevo escaneo para el historial con verificación de datos
                      const nuevoEscaneo = {
                        id: data.detalle?.id || 0,
                        codigo: data.detalle?.codigo || "",
                        cantidad: data.detalle?.cantidad || 0,
                        controlado: data.cantidadControlada || 0,
                        descripcion: productoEncontrado?.descripcion || data.producto?.descripcion || "",
                        timestamp: new Date(),
                        escaneado: true,
                        ubicacion: productoEncontrado?.ubicacion || data.producto?.ubicacion || "",
                        estado: data.controlEstado || "pendiente"
                      };
                      
                      // Verificar si hay productos excedentes
                      if (data.controlEstado === 'excedente') {
                        setProductoExcedente({
                          codigo: data.producto?.codigo || "",
                          descripcion: productoEncontrado?.descripcion || data.producto?.descripcion || "",
                          cantidadEsperada: data.producto?.cantidad || 0,
                          cantidadActual: data.cantidadControlada || 0
                        });
                        setExcedenteAlertOpen(true);
                      }
                      
                      return {
                        ...prev,
                        productosControlados: updatedProductos,
                        historialEscaneos: [...prev.historialEscaneos, nuevoEscaneo]
                      };
                    });
                  }}
                  onEscaneoError={(error) => {
                    console.error("Error en escaneo:", error);
                    
                    // Verificar si es un error de código no encontrado
                    const errorData = (error as any).data || {};
                    const codigo = (error as any).codigo || "";
                    
                    if (errorData.tipo === 'CODIGO_NO_ENCONTRADO') {
                      setCodigoNoEncontrado({
                        codigo: codigo,
                        descripcion: errorData.message || "Código no encontrado"
                      });
                      setAlertOpen(true);
                    } else {
                      // Es otro tipo de error, mostrar toast
                      toast({
                        title: "Error al escanear",
                        description: error instanceof Error ? error.message : "Error desconocido",
                        variant: "destructive"
                      });
                    }
                  }}
                  isDisabled={!controlState.isRunning || finalizarOpen}
                  inputRef={escanerInputRef}
                />
              </CardContent>
            </Card>
            
            {/* Productos escaneados */}
            <Card>
              <CardHeader>
                <CardTitle>Productos Escaneados</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Nuevo componente específico para mostrar productos escaneados */}
                <ProductosEscaneadosLista 
                  productos={controlState.historialEscaneos}
                  showEmpty={true}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      
      {/* Alertas y diálogos */}
      <CodigoNoEncontradoAlert 
        open={alertOpen}
        onOpenChange={setAlertOpen}
        codigo={codigoNoEncontrado.codigo}
        descripcion={codigoNoEncontrado.descripcion}
      />
      
      <ProductoExcedenteAlert
        open={excedenteAlertOpen}
        onOpenChange={setExcedenteAlertOpen}
        codigo={productoExcedente.codigo}
        descripcion={productoExcedente.descripcion}
        cantidadEsperada={productoExcedente.cantidadEsperada}
        cantidadActual={productoExcedente.cantidadActual}
      />
      
      <ControlFinalizarDialog
        open={finalizarOpen}
        onOpenChange={setFinalizarOpen}
        onFinalizar={handleFinalizarControl}
        hasFaltantes={hasFaltantes}
        hasExcedentes={controlState.productosControlados.some(p => p.controlado > p.cantidad)}
        comentarios={comentarios}
        onComentariosChange={setComentarios}
      />
      
      <RetirarExcedenteAlert
        open={retirarExcedenteOpen}
        onOpenChange={setRetirarExcedenteOpen}
        excedentes={productosExcedentes}
        onRetirarConfirm={completarFinalizacion}
      />
      
      <ControlFinalizadoDialog 
        open={finalizadoOpen}
        onOpenChange={setFinalizadoOpen}
        mensaje="El control del pedido ha sido finalizado correctamente"
      />
      
      {/* Modal simplificado de productos del pedido */}
      {pedidoId && (
        <PedidoProductosModal
          pedidoId={pedidoId}
          isOpen={detalleModalOpen}
          onClose={() => setDetalleModalOpen(false)}
        />
      )}
      
      {/* Modal de pausa de control */}
      {pedidoId && (
        <PausaControlModal
          isOpen={pausaModalOpen}
          onClose={() => setPausaModalOpen(false)}
          pedidoId={pedidoId}
          onPausaCreada={(pausaId) => {
            setPausaActualId(pausaId);
            setPausaActiva(true);
          }}
        />
      )}
    </MainLayout>
  );
}
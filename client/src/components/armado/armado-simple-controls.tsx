import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Componente para controles simples de armado (escaneo y recolección)
export function ArmadoSimpleControls({ 
  productos, 
  currentProductoIndex, 
  recolectados, 
  setRecolectados, 
  motivo, 
  setMotivo, 
  onGuardar, 
  pausaActiva = false, 
  onFinalizarPedido = () => {},
  mutationIsPending = false,
  esReanudacion = false
}: { 
  productos: any[];
  currentProductoIndex: number;
  recolectados: number | null;
  setRecolectados: (value: number | null) => void;
  motivo: string;
  setMotivo: (value: string) => void;
  onGuardar: () => void;
  pausaActiva?: boolean;
  onFinalizarPedido?: () => void;
  mutationIsPending?: boolean;
  esReanudacion?: boolean;
}) {
  const { toast } = useToast();
  const [motivosPredef, setMotivosPredef] = useState<string[]>([
    "Falta de stock",
    "Producto obsoleto",
    "Producto descontinuado",
    "Producto en mal estado",
    "Error en solicitud"
  ]);
  const [motivoCustom, setMotivoCustom] = useState("");
  
  // Estado para controlar el diálogo de finalización
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  
  // Estado para mostrar aviso de reanudación con faltante parcial
  const [mostrarAvisoFaltanteReanudado, setMostrarAvisoFaltanteReanudado] = useState(false);
  
  // Obtener producto actual
  const producto = productos[currentProductoIndex];
  
  // Verificar si estamos reanudando y hay un faltante parcial
  useEffect(() => {
    if (esReanudacion && producto && producto.recolectado !== null && 
        producto.recolectado < producto.cantidad && producto.motivo) {
      setMostrarAvisoFaltanteReanudado(true);
      
      // Mostrar toast de advertencia
      toast({
        title: "Producto con faltante parcial",
        description: `Este producto ya tiene registrado un faltante parcial (${producto.recolectado}/${producto.cantidad}) con motivo: "${producto.motivo}"`,
        variant: "warning",
      });
    } else {
      setMostrarAvisoFaltanteReanudado(false);
    }
  }, [esReanudacion, producto, toast]);
  
  // Manejar cambio en recolectados
  const handleRecolectadosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    
    // Validar que no sea mayor que la cantidad solicitada
    if (!isNaN(val) && val >= 0) {
      if (val > producto.cantidad) {
        toast({
          title: "Cantidad excedida",
          description: `No puede recolectar más de ${producto.cantidad} unidades`,
          variant: "destructive",
        });
        // Limitar al máximo permitido
        setRecolectados(producto.cantidad);
      } else {
        // Si estamos disminuyendo la cantidad previamente recolectada en un producto con faltante
        if (esReanudacion && producto.recolectado !== null && 
            producto.recolectado < producto.cantidad && producto.motivo && 
            val < producto.recolectado) {
          toast({
            title: "Alerta: Modificando faltante parcial",
            description: `Está disminuyendo la cantidad recolectada desde ${producto.recolectado} a ${val}. Esto actualizará el faltante parcial.`,
            variant: "warning",
          });
        }
        
        setRecolectados(val);
      }
    } else {
      // Si no es un número válido, establecer a 0
      setRecolectados(0);
    }
  };

  // Agregar motivo predefinido
  const handleAgregarMotivo = () => {
    if (motivoCustom.trim() !== "" && !motivosPredef.includes(motivoCustom)) {
      const nuevosMotivos = [...motivosPredef, motivoCustom];
      setMotivosPredef(nuevosMotivos);
      setMotivoCustom("");
      
      // Opcional: guardar en localStorage para persistencia
      localStorage.setItem('motivosFaltantes', JSON.stringify(nuevosMotivos));
      
      toast({
        title: "Motivo agregado",
        description: "El motivo ha sido agregado a la lista de opciones",
      });
    }
  };
  
  // Cargar motivos desde localStorage al inicio
  useEffect(() => {
    const storedMotivos = localStorage.getItem('motivosFaltantes');
    if (storedMotivos) {
      try {
        const parsed = JSON.parse(storedMotivos);
        if (Array.isArray(parsed)) {
          setMotivosPredef(parsed);
        }
      } catch (error) {
        console.error("Error parsing stored motivos:", error);
      }
    }
  }, []);

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl">
            {producto ? `Producto: ${producto.codigo} - ${producto.descripcion}` : 'Cargando...'}
          </CardTitle>
          
          {mostrarAvisoFaltanteReanudado && (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 px-3 py-1 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Faltante parcial registrado
            </Badge>
          )}
        </div>
        <CardDescription>
          {producto ? `Ubicación: ${producto.ubicacion || 'No especificada'}` : ''}
        </CardDescription>
      </CardHeader>
      
      {mostrarAvisoFaltanteReanudado && (
        <div className="mx-6 my-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Este producto ya tiene un faltante parcial registrado</p>
              <p className="text-yellow-700 mt-1">
                • Cantidad recolectada: <strong>{producto.recolectado}/{producto.cantidad}</strong><br />
                • Motivo registrado: <strong>"{producto.motivo}"</strong>
              </p>
              <p className="mt-2 text-yellow-700">
                Puede modificar estos valores si es necesario, pero tenga en cuenta que esto 
                actualizará el registro de faltante.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <CardContent className="space-y-4">
        {producto && (
          <>
            <div className="space-y-2">
              <label htmlFor="recolectados" className="block mb-1 font-medium">
                Cantidad Recolectada:
              </label>
              <Input
                id="recolectados"
                type="number"
                value={recolectados}
                onChange={handleRecolectadosChange}
                className="w-full"
                disabled={pausaActiva}
                min={0}
                max={producto.cantidad}
              />
              <p className="text-sm text-muted-foreground">
                Solicitados: {producto.cantidad}
              </p>
            </div>

            {recolectados === 0 && (
              <div className="space-y-2 mt-4">
                <label htmlFor="motivo" className="block mb-1 font-medium">
                  Motivo de Faltante:
                </label>
                <Select
                  value={motivo}
                  onValueChange={setMotivo}
                  disabled={pausaActiva}
                >
                  <SelectTrigger id="motivo">
                    <SelectValue placeholder="Seleccionar motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {motivosPredef.map((m, i) => (
                      <SelectItem key={i} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="flex space-x-2 mt-2">
                  <Input
                    placeholder="Nuevo motivo personalizado"
                    value={motivoCustom}
                    onChange={(e) => setMotivoCustom(e.target.value)}
                    disabled={pausaActiva}
                  />
                  <Button 
                    variant="outline" 
                    onClick={handleAgregarMotivo} 
                    disabled={motivoCustom.trim() === "" || pausaActiva}
                  >
                    Agregar
                  </Button>
                </div>
              </div>
            )}
            
            {recolectados > 0 && recolectados < productos[currentProductoIndex].cantidad && (
              <div className="space-y-2 mt-4">
                <label htmlFor="motivo" className="block mb-1 font-medium">
                  Motivo del Faltante Parcial:
                </label>
                <Select
                  value={motivo}
                  onValueChange={setMotivo}
                  disabled={pausaActiva}
                >
                  <SelectTrigger id="motivo">
                    <SelectValue placeholder="Indicar motivo del faltante" />
                  </SelectTrigger>
                  <SelectContent>
                    {motivosPredef.map((m, i) => (
                      <SelectItem key={i} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between pt-2">
        <Button 
          variant="outline" 
          onClick={() => setShowFinalizarDialog(true)}
          disabled={mutationIsPending || pausaActiva}
        >
          Finalizar Pedido
        </Button>
        
        <Button
          onClick={onGuardar}
          disabled={mutationIsPending || pausaActiva}
          className="gap-2"
        >
          {mutationIsPending ? 'Guardando...' : 'Guardar y Continuar'}
          <CheckCircle2 className="h-4 w-4" />
        </Button>
      </CardFooter>
      
      {/* Diálogo de confirmación para finalizar pedido */}
      <AlertDialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Finalizar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción finalizará el pedido actual y lo marcará como completado.
              Los productos no procesados se marcarán como faltantes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onFinalizarPedido();
                setShowFinalizarDialog(false);
              }}
            >
              Finalizar Pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
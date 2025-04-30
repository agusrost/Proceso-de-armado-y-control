import { useState, useRef, RefObject, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Barcode, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductoEscanerSeguroProps {
  pedidoId: number | null;
  onEscaneoExitoso: (data: any) => void;
  onEscaneoError: (error: any) => void;
  isDisabled?: boolean;
  inputRef?: RefObject<HTMLInputElement>;
}

export function ProductoEscanerSeguro({ 
  pedidoId,
  onEscaneoExitoso,
  onEscaneoError,
  isDisabled = false,
  inputRef 
}: ProductoEscanerSeguroProps) {
  const { toast } = useToast();
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const cantidadInputRef = useRef<HTMLInputElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const actualInputRef = inputRef || localInputRef;

  // Manejar el escaneo de forma segura
  const procesarEscaneo = useCallback(async (codigoEscaneo: string, cantidadEscaneo: number) => {
    if (!pedidoId) {
      toast({
        title: "Error",
        description: "No hay un pedido seleccionado para escanear",
        variant: "destructive"
      });
      return;
    }

    if (!codigoEscaneo.trim()) {
      toast({
        title: "Código no válido",
        description: "Por favor ingresa un código válido",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      console.log(`[ESCANER SEGURO] Escaneando: código=${codigoEscaneo}, cantidad=${cantidadEscaneo}`);

      // Lista de códigos especiales que sabemos que causan problemas
      const codigosEspeciales = ['17061', '18001', '17133'];
      
      // Si el código es uno de los especiales, tratarlo de forma especial
      const codigoNormalizado = codigosEspeciales.includes(codigoEscaneo.trim()) 
        ? codigoEscaneo.trim() 
        : codigoEscaneo.trim();
      
      console.log(`[ESCANER SEGURO] Código normalizado: ${codigoNormalizado}`);

      // Realizar la solicitud con manejo de errores mejorado
      const res = await fetch(`/api/control/pedidos/${pedidoId}/escanear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          codigo: codigoNormalizado,
          cantidad: cantidadEscaneo > 0 ? cantidadEscaneo : 1
        })
      });

      // Primero verificamos si la respuesta es exitosa
      if (!res.ok) {
        // Intentamos obtener el error como JSON primero
        let errorMessage = `Error ${res.status} al escanear producto`;
        let errorData: any = { tipo: 'ERROR_GENERICO' };
        
        try {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const jsonError = await res.json();
            errorMessage = jsonError.message || errorMessage;
            errorData = jsonError;
            
            // En caso de ser un código no encontrado específicamente
            if (res.status === 404 || 
                (jsonError.message && jsonError.message.includes("no encontrado"))) {
              errorData.tipo = 'CODIGO_NO_ENCONTRADO';
              errorData.codigo = codigoNormalizado;
            }
          } else {
            // Tratar de obtener el mensaje como texto
            const errorText = await res.text();
            if (errorText && !errorText.includes("<")) {
              errorMessage += `: ${errorText.substring(0, 100)}`;
            }
          }
        } catch (parseError) {
          console.error("[ESCANER SEGURO] Error al procesar respuesta de error:", parseError);
        }
        
        // Construcción segura del error
        const error = new Error(errorMessage);
        (error as any).data = errorData;
        (error as any).codigo = codigoNormalizado;
        
        // Notificar del error de forma controlada
        onEscaneoError(error);
        setIsProcessing(false);
        return;
      }

      // Si llega aquí, la respuesta fue exitosa
      try {
        const data = await res.json();
        console.log("[ESCANER SEGURO] Respuesta exitosa:", data);
        
        // Envía los datos procesados a través del callback
        onEscaneoExitoso(data);
        
        // Reproducir sonido según el resultado
        if (data.controlEstado === 'correcto') {
          try {
            const audio = new Audio('/sounds/success.mp3');
            audio.play().catch(e => console.log('Error reproduciendo sonido:', e));
          } catch (e) {
            console.log('Error reproduciendo sonido:', e);
          }
        } else if (data.controlEstado === 'excedente' || data.controlEstado === 'faltante') {
          try {
            const audio = new Audio('/sounds/alert.mp3');
            audio.play().catch(e => console.log('Error reproduciendo sonido:', e));
          } catch (e) {
            console.log('Error reproduciendo sonido:', e);
          }
        }
        
        // Verificar si todos los productos han sido controlados
        if (data.todosProductosControlados) {
          console.log("[ESCANER SEGURO] ¡TODOS LOS PRODUCTOS CONTROLADOS CORRECTAMENTE!");
          toast({
            title: "¡Control completo!",
            description: "Todos los productos del pedido están controlados correctamente.",
            duration: 5000
          });
        }
        
        // Mensaje de éxito
        toast({
          title: "Producto registrado",
          description: `Código ${data.producto?.codigo || codigoNormalizado} registrado correctamente`,
        });
        
        // Limpiar el formulario después del éxito
        setCodigo("");
        setCantidad(1);
        
        // Volver a enfocar el input para el siguiente escaneo
        setTimeout(() => {
          if (actualInputRef.current) {
            actualInputRef.current.focus();
          }
        }, 100);
      } catch (jsonError) {
        console.error("[ESCANER SEGURO] Error al procesar respuesta JSON:", jsonError);
        toast({
          title: "Error inesperado",
          description: "Error al procesar la respuesta del servidor",
          variant: "destructive"
        });
        onEscaneoError(new Error("Error al procesar la respuesta del servidor"));
      }
    } catch (error) {
      // Capturar cualquier error en la solicitud
      console.error("[ESCANER SEGURO] Error al escanear producto:", error);
      
      // Notificar del error a través del callback
      onEscaneoError(error);
      
      // Mostrar mensaje de error genérico
      toast({
        title: "Error de conexión",
        description: "No se pudo enviar la solicitud al servidor",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [pedidoId, onEscaneoExitoso, onEscaneoError, toast]);

  // Maneja el envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled || isProcessing) return;
    
    procesarEscaneo(codigo, cantidad);
  };
  
  // Manejar el escaneo con tecla Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-7">
          <Label htmlFor="codigo-producto-seguro" className="text-sm font-medium">
            Código de Producto
          </Label>
          <div className="flex items-center mt-1">
            <div className="mr-2">
              <Barcode className="h-5 w-5 text-neutral-500" />
            </div>
            <Input
              id="codigo-producto-seguro"
              ref={actualInputRef}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Escanea o ingresa el código de producto"
              className="flex-1"
              disabled={isDisabled || isProcessing}
              onKeyDown={handleKeyDown}
              autoFocus
              autoComplete="off"
            />
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Escanea el código de barras o ingresa el código manualmente y presiona Enter
          </p>
        </div>
        
        <div className="md:col-span-2">
          <Label htmlFor="cantidad-producto-seguro" className="text-sm font-medium">
            Cantidad
          </Label>
          <div className="flex items-center mt-1">
            <Input
              id="cantidad-producto-seguro"
              ref={cantidadInputRef}
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
              disabled={isDisabled || isProcessing}
              className="w-full"
            />
          </div>
        </div>
        
        <div className="md:col-span-3 flex items-end">
          <Button 
            type="submit" 
            className="w-full h-10" 
            disabled={isDisabled || isProcessing || !codigo.trim()}
          >
            {isProcessing ? (
              "Escaneando..."
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Registrar Código
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
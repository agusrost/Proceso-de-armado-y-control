import { useState, useRef, RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Barcode, Send } from "lucide-react";

interface ProductoEscanerFormProps {
  onEscanear: (codigo: string, cantidad?: number) => void;
  isLoading: boolean;
  inputRef?: RefObject<HTMLInputElement>;
}

export function ProductoEscanerForm({ 
  onEscanear, 
  isLoading,
  inputRef 
}: ProductoEscanerFormProps) {
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState<number>(1);
  const cantidadInputRef = useRef<HTMLInputElement>(null);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (codigo.trim()) {
      // Hacemos log del valor exacto que se está enviando para depuración
      console.log("Enviando código para escaneo:", codigo.trim(), "tipo:", typeof codigo);
      
      // Tratamiento especial para códigos conocidos que pueden tener problemas
      const codigoTrim = codigo.trim();
      const codigosEspeciales = ['17061', '18001'];
      
      // Si el código es uno de los especiales, lo enviamos tal cual
      if (codigosEspeciales.includes(codigoTrim)) {
        console.log(`⚠️ Código especial detectado: ${codigoTrim} - Enviando sin normalizar`);
        onEscanear(codigoTrim, cantidad);
        setCodigo("");
        return;
      }
      
      // Normalizamos el código antes de enviarlo para casos normales
      const normalizedCode = codigo.trim().toLowerCase();
      console.log("Código normalizado:", normalizedCode);
      
      // Enviamos el código normalizado
      onEscanear(normalizedCode, cantidad);
      setCodigo("");
    }
  };
  
  // Manejar el escaneo de códigos (tecla Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  // Incrementar o decrementar cantidad
  const adjustCantidad = (amount: number) => {
    setCantidad(prev => Math.max(1, prev + amount));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="md:col-span-4">
          <Label htmlFor="codigo-producto">Código de Producto</Label>
          <div className="flex items-center mt-1">
            <div className="mr-2">
              <Barcode className="h-5 w-5 text-neutral-500" />
            </div>
            <Input
              id="codigo-producto"
              ref={inputRef}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Escanea o ingresa el código de producto"
              className="flex-1"
              disabled={isLoading}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Presiona Enter después de escanear o ingresa el código manualmente
          </p>
        </div>
        
        <div>
          <Label htmlFor="cantidad-producto">Cantidad</Label>
          <Input
            id="cantidad-producto"
            ref={cantidadInputRef}
            type="number"
            min="1"
            value={cantidad}
            onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
            disabled={isLoading}
            className="mt-1"
          />
        </div>
        
        <div className="flex items-end">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !codigo.trim()}
          >
            {isLoading ? (
              "Escaneando..."
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Registrar
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
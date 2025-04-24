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
      
      // Lista de códigos especiales que sabemos que causan problemas
      const codigosEspeciales = ['17061', '18001', '17133'];
      
      // Si el código es uno de los especiales, lo enviamos tal cual sin normalizar
      if (codigosEspeciales.includes(codigoTrim)) {
        console.log(`⚠️⚠️⚠️ CÓDIGO ESPECIAL DETECTADO: ${codigoTrim} - Enviando sin normalizar`);
        onEscanear(codigoTrim, cantidad);
        setCodigo("");
        setCantidad(1); // Reiniciar la cantidad a 1
        return;
      }
      
      // Caso especial para variantes con espacios o caracteres especiales del código 17061
      if (codigoTrim.replace(/\s|-|\./, '') === '17061' || 
          codigoTrim === '1 7061' || 
          codigoTrim === '1-7061' ||
          codigoTrim.includes('17061')) {
        console.log(`⚠️⚠️⚠️ VARIANTE DEL CÓDIGO ESPECIAL 17061 DETECTADA: ${codigoTrim} - Normalizando a 17061`);
        onEscanear('17061', cantidad);
        setCodigo("");
        setCantidad(1); // Reiniciar la cantidad a 1
        return;
      }
      
      // Caso especial para variantes con espacios o caracteres especiales del código 18001
      if (codigoTrim.replace(/\s|-|\./, '') === '18001' || 
          codigoTrim === '1 8001' || 
          codigoTrim === '1-8001' ||
          codigoTrim.includes('18001')) {
        console.log(`⚠️⚠️⚠️ VARIANTE DEL CÓDIGO ESPECIAL 18001 DETECTADA: ${codigoTrim} - Normalizando a 18001`);
        onEscanear('18001', cantidad);
        setCodigo("");
        setCantidad(1); // Reiniciar la cantidad a 1
        return;
      }
      
      // Normalizamos el código antes de enviarlo para casos normales
      const normalizedCode = codigo.trim();
      console.log("Código normalizado:", normalizedCode);
      
      // Enviamos el código normalizado
      onEscanear(normalizedCode, cantidad);
      setCodigo("");
      // Reiniciamos la cantidad a 1 después de escanear
      setCantidad(1);
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
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-7">
          <Label htmlFor="codigo-producto" className="text-sm font-medium">Código de Producto</Label>
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
              autoFocus
              autoComplete="off"
            />
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Escanea el código de barras o ingresa el código manualmente y presiona Enter
          </p>
        </div>
        
        <div className="md:col-span-2">
          <Label htmlFor="cantidad-producto" className="text-sm font-medium">Cantidad</Label>
          <div className="flex items-center mt-1">
            <Input
              id="cantidad-producto"
              ref={cantidadInputRef}
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
              disabled={isLoading}
              className="w-full"
            />
          </div>
        </div>
        
        <div className="md:col-span-3 flex items-end">
          <Button 
            type="submit" 
            className="w-full h-10" 
            disabled={isLoading || !codigo.trim()}
          >
            {isLoading ? (
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
import { Barcode, Check, X, Clock } from "lucide-react";
import { ProductoControlado } from "@shared/types";
import { formatTimestamp } from "@/lib/utils";

type ProductosEscaneadosListaProps = {
  productos: Array<ProductoControlado & { timestamp?: Date; escaneado?: boolean }>;
  showEmpty?: boolean;
};

export function ProductosEscaneadosLista({ productos, showEmpty = false }: ProductosEscaneadosListaProps) {
  // Log detallado de los productos para depuración
  console.log("Renderizando ProductosEscaneadosLista con", productos.length, "productos");
  
  // Verificamos específicamente si hay productos con cantidades
  if (productos.length > 0) {
    const ejemplo = productos[0];
    console.log("Ejemplo de producto:", {
      codigo: ejemplo.codigo,
      cantidad: ejemplo.cantidad,
      controlado: ejemplo.controlado,
      estado: ejemplo.estado,
      timestamp: ejemplo.timestamp
    });
  }
  
  // Si no hay productos y showEmpty es false, no mostramos nada
  if (productos.length === 0 && !showEmpty) {
    return null;
  }
  
  // Si no hay productos pero showEmpty es true, mostramos mensaje
  if (productos.length === 0 && showEmpty) {
    return (
      <div className="text-center py-6 text-neutral-500">
        No se han registrado productos todavía
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {productos.map((producto, index) => (
        <div 
          key={`${producto.codigo}-${index}`} 
          className={`flex items-center justify-between border p-3 rounded-md ${!producto.escaneado ? 'opacity-70' : ''}`}
        >
          <div className="flex items-center">
            <Barcode className={`h-5 w-5 mr-3 ${!producto.escaneado ? 'text-neutral-400' : 'text-neutral-500'}`} />
            <div>
              <div className={`font-medium ${!producto.escaneado ? 'text-neutral-500' : ''}`}>
                {producto.codigo ? (
                  <>
                    {producto.codigo} 
                    {producto.descripcion && ` - ${producto.descripcion}`}
                    {!producto.escaneado && <span className="text-sm text-neutral-400 ml-2">(Pendiente)</span>}
                  </>
                ) : (
                  <span className="text-neutral-500">Sin código</span>
                )}
              </div>
              <div className="text-sm text-neutral-500">
                {producto.escaneado && producto.timestamp 
                  ? formatTimestamp(producto.timestamp) 
                  : producto.escaneado === false
                    ? "Pendiente de escanear"
                    : "Sin fecha"
                }
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="px-2 py-1 text-sm rounded-full border mr-2 flex flex-col items-center">
              <div className="flex items-center">
                <span className={`font-medium ${
                  producto.controlado < producto.cantidad ? 'text-amber-600' : 
                  producto.controlado > producto.cantidad ? 'text-blue-600' : 'text-emerald-600'
                }`}>
                  {producto.controlado} / {producto.cantidad}
                </span>
              </div>
              <div className="text-[9px] text-neutral-400">
                Registrada / Solicitada
              </div>
            </div>
            {producto.estado === 'correcto' ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : producto.estado === 'faltante' ? (
              <X className="h-5 w-5 text-red-500" />
            ) : producto.estado === 'excedente' ? (
              <div className="text-amber-500 text-sm font-medium">+{producto.controlado - producto.cantidad}</div>
            ) : (
              <Clock className="h-5 w-5 text-neutral-400" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
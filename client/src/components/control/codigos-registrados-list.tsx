import { Barcode, Check, X } from "lucide-react";
import { ProductoControlado } from "@shared/types";
import { formatTimestamp } from "@/lib/utils";

type CodigosRegistradosListProps = {
  productos: Array<ProductoControlado & { timestamp?: Date; escaneado?: boolean }>;
};

export function CodigosRegistradosList({ productos }: CodigosRegistradosListProps) {
  // Filtrar solo los productos que han sido escaneados
  const productosEscaneados = productos.filter(p => p.escaneado || p.controlado > 0);
  
  // Ordenar por timestamp más reciente primero
  const productosOrdenados = [...productosEscaneados].sort((a, b) => {
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  if (productosOrdenados.length === 0) {
    return (
      <div className="text-center py-6 text-neutral-500">
        No se han registrado códigos todavía
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {productosOrdenados.map((producto, index) => (
        <div 
          key={`${producto.codigo}-${index}`} 
          className="flex items-center justify-between border p-3 rounded-md"
        >
          <div className="flex items-center">
            <Barcode className="h-5 w-5 text-neutral-500 mr-3" />
            <div>
              <div className="font-medium">
                {producto.codigo} - {producto.descripcion}
              </div>
              <div className="text-sm text-neutral-500">
                {producto.timestamp ? formatTimestamp(producto.timestamp) : "Sin fecha"}
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="px-2 py-1 text-sm rounded-full border mr-2">
              {producto.controlado} / {producto.cantidad}
            </div>
            {producto.estado === 'correcto' ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : producto.estado === 'faltante' ? (
              <X className="h-5 w-5 text-red-500" />
            ) : producto.estado === 'excedente' ? (
              <div className="text-amber-500 text-sm font-medium">+{producto.controlado - producto.cantidad}</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
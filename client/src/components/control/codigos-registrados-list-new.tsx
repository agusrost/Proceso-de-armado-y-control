import { Barcode, Check, X } from "lucide-react";
import { ProductoControlado } from "@shared/types";
import { formatTimestamp } from "@/lib/utils";

type CodigosRegistradosListProps = {
  registros: Array<ProductoControlado & { timestamp?: Date; escaneado?: boolean }>;
  showEmpty?: boolean;
};

export function CodigosRegistradosList({ registros, showEmpty = false }: CodigosRegistradosListProps) {
  // Filtrar solo los productos que han sido escaneados
  const productosEscaneados = registros.filter((p: any) => p.escaneado || p.controlado > 0);
  
  // Agrupar productos por código para evitar duplicados
  const productosAgrupados = productosEscaneados.reduce((acc: Record<string, any>, producto: any) => {
    // Si ya existe el código, actualizar los datos
    if (acc[producto.codigo]) {
      // Actualizar la cantidad controlada sumándola
      acc[producto.codigo].controlado += producto.controlado;
      
      // Actualizar el timestamp si el actual es más reciente
      if (producto.timestamp && (!acc[producto.codigo].timestamp || 
          producto.timestamp.getTime() > acc[producto.codigo].timestamp.getTime())) {
        acc[producto.codigo].timestamp = producto.timestamp;
      }
      
      // Determinar el estado basado en la cantidad actualizada
      if (acc[producto.codigo].controlado > acc[producto.codigo].cantidad) {
        acc[producto.codigo].estado = 'excedente';
      } else if (acc[producto.codigo].controlado < acc[producto.codigo].cantidad) {
        acc[producto.codigo].estado = 'faltante';
      } else {
        acc[producto.codigo].estado = 'correcto';
      }
    } else {
      // Si no existe, agregarlo al acumulador
      acc[producto.codigo] = { ...producto };
    }
    return acc;
  }, {});
  
  // Convertir el objeto de productos agrupados a un array
  const productosConsolidados = Object.values(productosAgrupados);
  
  // Ordenar por timestamp más reciente primero
  const productosOrdenados = [...productosConsolidados].sort((a: any, b: any) => {
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
      {productosOrdenados.map((producto: any, index: number) => (
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
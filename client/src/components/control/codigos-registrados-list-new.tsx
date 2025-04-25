import { Barcode, Check, X } from "lucide-react";
import { ProductoControlado } from "@shared/types";
import { formatTimestamp } from "@/lib/utils";

type CodigosRegistradosListProps = {
  registros: Array<ProductoControlado & { timestamp?: Date; escaneado?: boolean }>;
  showEmpty?: boolean;
};

export function CodigosRegistradosList({ registros, showEmpty = false }: CodigosRegistradosListProps) {
  // Validación mejorada: filtrar registros nulos o inválidos
  const registrosValidos = registros.filter((p) => 
    p && typeof p === 'object' && 
    p.codigo && typeof p.codigo === 'string' && 
    p.codigo.trim() !== "" && 
    (p.escaneado || p.controlado > 0)
  );
  
  console.log(`Procesando ${registrosValidos.length} registros válidos para agrupar`);
  
  // Usar Map para agrupar los productos por código
  const productosMap = new Map();
  
  // Primero procesar todos los registros para asegurar que tenemos todos los datos correctos
  registrosValidos.forEach((producto) => {
    const codigo = producto.codigo?.trim();
    
    // Validación adicional
    if (!codigo) {
      console.warn("Producto sin código detectado:", producto);
      return;
    }
    
    // Si ya existe el código en el mapa, actualizar datos 
    if (productosMap.has(codigo)) {
      const existente = productosMap.get(codigo);
      
      // Acumular cantidades (considerando que puede ser undefined)
      const nuevaControlada = (existente.controlado || 0) + (producto.cantidad || 0);
      
      // Actualizar el registro existente con los datos más recientes
      productosMap.set(codigo, {
        ...existente,
        controlado: nuevaControlada,
        cantidad: producto.cantidad > existente.cantidad ? producto.cantidad : existente.cantidad,
        // Seleccionar el timestamp más reciente
        timestamp: producto.timestamp && existente.timestamp 
          ? (producto.timestamp > existente.timestamp ? producto.timestamp : existente.timestamp)
          : (producto.timestamp || existente.timestamp),
      });
      
      console.log(`Actualizado producto ${codigo}: cantidad controlada=${nuevaControlada}`);
    } else {
      // Asegurar datos consistentes antes de agregar
      const nuevoProducto = {
        ...producto,
        codigo: codigo,
        descripcion: producto.descripcion || "Sin descripción",
        cantidad: producto.cantidad || 0,
        controlado: producto.controlado || producto.cantidad || 0,
        timestamp: producto.timestamp || new Date(),
      };
      
      productosMap.set(codigo, nuevoProducto);
      console.log(`Nuevo producto agregado: ${codigo} - ${nuevoProducto.descripcion}`);
    }
  });
  
  // Calcular el estado basado en las cantidades después de agrupar
  productosMap.forEach((producto, codigo) => {
    // Determinar el estado basado en cantidades
    let estado;
    if (producto.cantidad === 0) {
      estado = 'correcto'; // Si no hay cantidad esperada, marcar como correcto
    } else if (producto.controlado > producto.cantidad) {
      estado = 'excedente';
    } else if (producto.controlado < producto.cantidad) {
      estado = 'faltante';
    } else {
      estado = 'correcto';
    }
    
    productosMap.set(codigo, {
      ...producto,
      estado
    });
  });
  
  // Convertir a array y ordenar por timestamp (más reciente primero)
  const productosOrdenados = Array.from(productosMap.values())
    .sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  
  console.log(`Productos agrupados finales: ${productosOrdenados.length}`);
  
  // Mostrar mensaje si no hay productos
  if (productosOrdenados.length === 0 && showEmpty) {
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
                {producto.codigo ? (
                  <>
                    {producto.codigo} 
                    {producto.descripcion && ` - ${producto.descripcion}`}
                  </>
                ) : (
                  <span className="text-neutral-500">Sin código</span>
                )}
              </div>
              <div className="text-sm text-neutral-500">
                {producto.timestamp ? formatTimestamp(producto.timestamp) : "Sin fecha"}
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="px-2 py-1 text-sm rounded-full border mr-2">
              {producto.controlado || 0} / {producto.cantidad || 0}
            </div>
            {producto.estado === 'correcto' ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : producto.estado === 'faltante' ? (
              <X className="h-5 w-5 text-red-500" />
            ) : producto.estado === 'excedente' ? (
              <div className="text-amber-500 text-sm font-medium">+{(producto.controlado || 0) - (producto.cantidad || 0)}</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
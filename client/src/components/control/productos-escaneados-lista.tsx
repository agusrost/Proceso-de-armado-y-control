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
    
    // Verificamos si hay productos con códigos específicos para depuración
    const codigosEspeciales = ['17061', '18001', '18002'];
    codigosEspeciales.forEach(codigo => {
      const productoEspecial = productos.find(p => p.codigo === codigo);
      if (productoEspecial) {
        console.log(`DETALLE IMPORTANTE - Producto ${codigo}:`, {
          codigo: productoEspecial.codigo,
          cantidad: productoEspecial.cantidad,
          controlado: productoEspecial.controlado,
          estado: productoEspecial.estado
        });
      }
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

  // Usar Map para agrupar los productos por código y quedarnos con la última versión de cada uno
  // Esto asegura que cada código aparezca una sola vez con su información más actualizada
  const productosMap = new Map();
  
  // Para debug: imprimir valores iniciales
  if (productos.length > 0) {
    console.log("AGRUPANDO PRODUCTOS PARA MOSTRAR:");
    productos.forEach(p => {
      if (p.codigo) {
        console.log(`Producto ${p.codigo}: controlado=${p.controlado}, cantidad=${p.cantidad}, estado=${p.estado}`);
      }
    });
  }
  
  productos.forEach((producto) => {
    const codigo = producto.codigo?.trim();
    if (!codigo) return; // Saltamos productos sin código
    
    // Si ya existía el código, actualizamos con la versión más reciente
    if (productosMap.has(codigo)) {
      const productoExistente = productosMap.get(codigo);
      const timestamp = producto.timestamp && productoExistente.timestamp 
        ? (new Date(producto.timestamp) > new Date(productoExistente.timestamp) ? producto.timestamp : productoExistente.timestamp)
        : (producto.timestamp || productoExistente.timestamp);
      
      // Tomamos siempre los valores más recientes o más altos para controlado
      const controlado = typeof producto.controlado === 'number' 
        ? producto.controlado 
        : (productoExistente.controlado || 0);
      
      // La cantidad solicitada nunca debería cambiar, pero por si acaso
      const cantidad = producto.cantidad || productoExistente.cantidad || 0;
      
      // Si el estado es más reciente, lo usamos
      const estado = producto.estado || productoExistente.estado;
      
      // Debug
      console.log(`${codigo}: Actualizando de ${productoExistente.controlado}/${productoExistente.cantidad} a ${controlado}/${cantidad} (${estado})`);
      
      productosMap.set(codigo, {
        ...productoExistente,
        controlado,
        cantidad,
        estado,
        timestamp,
        descripcion: producto.descripcion || productoExistente.descripcion,
        escaneado: true // Aseguramos que se muestre como escaneado
      });
    } else {
      // Si es un código nuevo, lo agregamos al mapa
      const controlado = typeof producto.controlado === 'number' ? producto.controlado : 0;
      const cantidad = producto.cantidad || 0;
      
      console.log(`${codigo}: Agregando nuevo producto ${controlado}/${cantidad} (${producto.estado || "pendiente"})`);
      
      productosMap.set(codigo, {
        ...producto,
        codigo,
        controlado,
        cantidad,
        escaneado: true // Aseguramos que se muestre como escaneado
      });
    }
  });
  
  // Convertir el mapa a un arreglo ordenado por timestamp (más reciente primero)
  const productosAgrupados = Array.from(productosMap.values())
    .sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  
  console.log(`Productos agrupados para mostrar: ${productosAgrupados.length}`);

  return (
    <div className="space-y-2">
      {productosAgrupados.map((producto, index) => (
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
                  {typeof producto.controlado === 'number' ? producto.controlado : 0} / {producto.cantidad || 0}
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
              <Check className="h-5 w-5 text-amber-500" />
            ) : (
              <Clock className="h-5 w-5 text-neutral-400" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
import { Barcode, Check, X, Clock } from "lucide-react";
import { ProductoControlado } from "@shared/types";
import { formatTimestamp } from "@/lib/utils";

type CodigosRegistradosListProps = {
  registros: Array<ProductoControlado & { timestamp?: Date; escaneado?: boolean }>;
  showEmpty?: boolean;
};

export function CodigosRegistradosList({ registros, showEmpty = false }: CodigosRegistradosListProps) {
  // Log detallado de los registros para depuración
  console.log("Registros recibidos:", JSON.stringify(registros));
  
  // Verificar específicamente el producto con código 17061
  const producto17061 = registros.find(p => p?.codigo === '17061');
  if (producto17061) {
    console.log("DATOS PRODUCTO 17061:", {
      codigo: producto17061.codigo,
      cantidad: producto17061.cantidad, // Cantidad solicitada (debe ser 2)
      controlado: producto17061.controlado, // Cantidad registrada (debe ser 1)
      estado: producto17061.estado
    });
  }
  
  // Validación mejorada: filtrar registros nulos o inválidos
  const registrosValidos = registros.filter((p) => 
    p && typeof p === 'object' && 
    p.codigo && typeof p.codigo === 'string' && 
    p.codigo.trim() !== ""
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
      
      // La cantidad controlada del último escaneo (o 1 si no está definida)
      const cantidadEscaneada = producto.cantidad || 1;
      
      // NO acumulamos la cantidad, usamos la controlada real del producto
      // Esta es la cantidad registrada hasta el momento según el backend
      const cantidadActual = producto.controlado || 0;
      
      // IMPORTANTE: Verificar si tiene acción de excedente_retirado o _forzarVisualizacion
      const accion = producto.accion || existente.accion;
      const _forzarVisualizacion = producto._forzarVisualizacion || existente._forzarVisualizacion;
      
      // Si es un producto con excedente retirado o forzarVisualizacion, usar la cantidad esperada para mostrar 7/7
      const cantidadFinal = (accion === 'excedente_retirado' || _forzarVisualizacion || producto.estado === 'correcto')
        ? producto.cantidad  // Usar cantidad esperada para mostrar correctamente
        : cantidadActual;    // Usar cantidad real del backend
      
      // Actualizar el registro existente con los datos más recientes
      productosMap.set(codigo, {
        ...existente,
        // Usar la cantidad controlada adecuada según el caso
        controlado: cantidadFinal,
        // Mantener la cantidad esperada (la del pedido original)
        cantidad: producto.cantidad > existente.cantidad ? producto.cantidad : existente.cantidad,
        // Seleccionar el timestamp más reciente
        timestamp: producto.timestamp && existente.timestamp 
          ? (producto.timestamp > existente.timestamp ? producto.timestamp : existente.timestamp)
          : (producto.timestamp || existente.timestamp),
        // PRESERVE THESE IMPORTANT VALUES
        accion,
        _forzarVisualizacion,
        // Si es un excedente retirado o tiene _forzarVisualizacion, forzar estado a correcto
        estado: accion === 'excedente_retirado' || _forzarVisualizacion ? 'correcto' : existente.estado
      });
      
      console.log(`Actualizado producto ${codigo}: cantidad controlada=${cantidadActual}, escaneo=${cantidadEscaneada}`);
    } else {
      // IMPORTANTE: Verificar si tiene acción de excedente_retirado o _forzarVisualizacion
      const accion = producto.accion;
      const _forzarVisualizacion = producto._forzarVisualizacion;
      
      // Si es un producto con excedente retirado o forzarVisualizacion, usar la cantidad esperada para mostrar 7/7
      const cantidadFinal = (accion === 'excedente_retirado' || _forzarVisualizacion || producto.estado === 'correcto')
        ? producto.cantidad  // Usar cantidad esperada para mostrar correctamente
        : producto.controlado || 0;    // Usar cantidad real del backend
      
      // Asegurar datos consistentes antes de agregar
      const nuevoProducto = {
        ...producto,
        codigo: codigo,
        descripcion: producto.descripcion || "Sin descripción",
        // Cantidad esperada (del pedido original)
        cantidad: producto.cantidad || 0,
        // Cantidad registrada hasta el momento (forzar si es necesario)
        controlado: cantidadFinal,
        timestamp: producto.timestamp || new Date(),
        // Preservar propiedades importantes
        accion,
        _forzarVisualizacion,
        // Si tiene acción especial, forzar estado a correcto
        estado: accion === 'excedente_retirado' || _forzarVisualizacion ? 'correcto' : producto.estado
      };
      
      productosMap.set(codigo, nuevoProducto);
      console.log(`Nuevo producto agregado: ${codigo} - ${nuevoProducto.descripcion}, controlado=${nuevoProducto.controlado}`);
    }
  });
  
  // Calcular el estado basado en las cantidades después de agrupar
  productosMap.forEach((producto, codigo) => {
    // VERIFICACIÓN CRÍTICA: Si tiene accion=excedente_retirado o _forzarVisualizacion, FORZAR valores
    if (producto.accion === 'excedente_retirado' || producto._forzarVisualizacion) {
      console.log(`FORZANDO VISUALIZACIÓN para ${codigo}: Mostrando ${producto.cantidad}/${producto.cantidad}`);
      
      // Forzar valores a cantidad exacta para mostrar
      productosMap.set(codigo, {
        ...producto,
        controlado: producto.cantidad, // Forzar cantidad controlada igual a la solicitada
        estado: 'correcto', // Forzar estado correcto
        accion: 'excedente_retirado', // Preservar acción
        _forzarVisualizacion: true // Preservar indicador especial
      });
      return; // Salir para este producto
    }
    
    // Para productos normales (sin excedentes retirados), calcular estado normal
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
                <span className={`${producto.controlado !== producto.cantidad ? 'font-medium' : ''} ${
                  producto.accion === 'excedente_retirado' ? 'text-emerald-600' :
                  producto._forzarVisualizacion ? 'text-emerald-600' :
                  producto.controlado < producto.cantidad ? 'text-amber-600' : 
                  producto.controlado > producto.cantidad ? 'text-blue-600' : 'text-emerald-600'
                }`}>
                  {/* SOLUCIÓN MEGA FORZADA: Si tiene acción excedente_retirado o _forzarVisualizacion, mostrar cantidad/cantidad */}
                  {(producto.accion === 'excedente_retirado' || producto._forzarVisualizacion || producto.estado === 'correcto')
                    ? `${producto.cantidad || 0} / ${producto.cantidad || 0}` // Mostrar exactamente la cantidad solicitada
                    : `${producto.controlado || 0} / ${producto.cantidad || 0}` // Comportamiento normal para otros productos
                  }
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
              <div className="text-amber-500 text-sm font-medium">+{(producto.controlado || 0) - (producto.cantidad || 0)}</div>
            ) : producto.escaneado === false ? (
              <Clock className="h-5 w-5 text-neutral-400" />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
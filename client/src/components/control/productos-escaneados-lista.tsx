import { ProductoControlado } from "@shared/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Clock, Search } from "lucide-react";

interface ProductosEscaneadosListaProps {
  productos: ProductoControlado[];
  title?: string;
  description?: string;
  emptyMessage?: string;
  className?: string;
}

export function ProductosEscaneadosLista({
  productos,
  title = "Productos Escaneados",
  description = "Lista de productos registrados",
  emptyMessage = "No hay productos escaneados aún",
  className = ""
}: ProductosEscaneadosListaProps) {
  // Filtrar por productos únicos usando el código como clave
  const productosUnicos = productos.reduce((acc: ProductoControlado[], current) => {
    const x = acc.find(item => item.codigo === current.codigo);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, []);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={`max-h-[500px] overflow-y-auto ${productos.length === 0 ? 'flex items-center justify-center min-h-[200px]' : ''}`}>
        {productos.length > 0 ? (
          <div className="space-y-3">
            {productosUnicos.map((producto) => {
              // Determinar estado
              const estado = producto.controlado < producto.cantidad ? 'incompleto' :
                             producto.controlado > producto.cantidad ? 'excedente' : 'completo';

              return (
                <div
                  key={producto.codigo}
                  className={`p-3 rounded-md border ${
                    estado === 'incompleto' ? 'border-yellow-200 bg-yellow-50' : 
                    estado === 'excedente' ? 'border-red-200 bg-red-50' : 
                    'border-green-200 bg-green-50'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{producto.codigo}</span>
                        <Badge variant={
                          estado === 'incompleto' ? 'outline' :
                          estado === 'excedente' ? 'destructive' :
                          'default'
                        }>
                          {estado === 'incompleto' ? 'INCOMPLETO' :
                           estado === 'excedente' ? 'EXCEDENTE' :
                           'COMPLETO'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{producto.descripcion}</p>
                      {producto.ubicacion && (
                        <p className="text-xs text-gray-500 mt-1">Ubicación: {producto.ubicacion}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center">
                      <div className={`
                        text-lg font-bold 
                        ${estado === 'incompleto' ? 'text-yellow-600' : 
                          estado === 'excedente' ? 'text-red-600' : 
                          'text-green-600'}
                      `}>
                        {producto.controlado}/{producto.cantidad}
                      </div>
                      <div className="ml-2">
                        {estado === 'incompleto' && <Clock className="h-5 w-5 text-yellow-500" />}
                        {estado === 'excedente' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                        {estado === 'completo' && <CheckCircle className="h-5 w-5 text-green-500" />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-gray-500 flex flex-col items-center">
            <Search className="h-12 w-12 text-gray-300 mb-2" />
            <p>{emptyMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
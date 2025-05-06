import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Pedido } from "@shared/schema";
import { Search, X, ClipboardCheck, Package, AlertTriangle, Eye, CheckCircle2, PauseCircle, PlayCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface SearchPedidoFormProps {
  onPedidoFound: (pedido: Pedido) => void;
  onError: (error: string | null) => void;
}

export function SearchPedidoForm({ onPedidoFound, onError }: SearchPedidoFormProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"id" | "cliente">("id");
  const [isLoading, setIsLoading] = useState(false);
  const [searchedPedidos, setSearchedPedidos] = useState<Pedido[]>([]);

  // Query para obtener todos los pedidos listos para control
  const { data: pedidosCompletados = [], isLoading: isLoadingPedidos, refetch } = useQuery({
    queryKey: ["/api/pedidos", { estadosControl: true }],
    queryFn: async () => {
      // Obtenemos los pedidos en estado 'armado' y 'armado-pendiente-stock', 
      // usando el endpoint específico para pedidos en control
      const res = await apiRequest("GET", "/api/control/en-curso");
      if (!res.ok) return [];
      const pedidos = await res.json();
      
      // Obtener información de los armadores
      return await Promise.all(pedidos.map(async (pedido: any) => {
        if (pedido.armadorId) {
          try {
            const armadorRes = await apiRequest("GET", `/api/users/${pedido.armadorId}`);
            if (armadorRes.ok) {
              const armador = await armadorRes.json();
              return {
                ...pedido,
                armadorNombre: armador.firstName || armador.username || `Armador ID ${pedido.armadorId}`
              };
            }
          } catch (error) {
            console.error("Error al obtener información del armador:", error);
          }
        }
        return pedido;
      }));
    },
    refetchInterval: false, // Deshabilitamos cualquier refresco automático
    refetchOnWindowFocus: false, // No refrescar al enfocar la ventana
  });

  // Ordenar los pedidos por fecha de finalización (los más recientes primero)
  const sortedPedidos = [...pedidosCompletados].sort((a, b) => {
    const dateA = a.finalizado ? new Date(a.finalizado).getTime() : 0;
    const dateB = b.finalizado ? new Date(b.finalizado).getTime() : 0;
    return dateB - dateA;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) {
      onError("Por favor ingresa un valor para buscar");
      return;
    }
    
    setIsLoading(true);
    onError(null);
    setSearchedPedidos([]);
    
    try {
      let endpoint = searchType === "id" 
        ? `/api/pedidos/buscar?id=${encodeURIComponent(searchTerm.trim())}`
        : `/api/pedidos/buscar?clienteId=${encodeURIComponent(searchTerm.trim())}`;
      
      const res = await apiRequest("GET", endpoint);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Error al obtener respuesta del servidor" }));
        
        if (res.status === 404) {
          if (errorData.todosYaControlados) {
            onError("Todos los pedidos encontrados ya fueron controlados anteriormente");
          } else {
            onError("Pedido no encontrado");
          }
        } else if (res.status === 400 && errorData.yaControlado) {
          // Caso especial: pedido ya controlado
          onError(`${errorData.message} - Este pedido no se puede controlar de nuevo.`);
          
          // Mostrar más información sobre el pedido ya controlado
          if (errorData.pedido) {
            toast({
              title: "Pedido ya controlado",
              description: `El pedido ${errorData.pedido.pedidoId} (Cliente: ${errorData.pedido.clienteId}) ya fue controlado anteriormente.`,
              variant: "destructive"
            });
          }
        } else {
          onError(errorData.message || "Error al buscar el pedido");
        }
        return;
      }
      
      const data = await res.json();
      
      // Si es un array de pedidos
      if (Array.isArray(data)) {
        // Verificar si hay resultados
        if (data.length === 0) {
          onError("No se encontraron pedidos pendientes de control");
          return;
        }
        
        setSearchedPedidos(data);
        if (data.length === 1) {
          // Si solo hay un resultado, lo seleccionamos automáticamente
          onPedidoFound(data[0]);
        }
      } else {
        // Si es un solo pedido
        onPedidoFound(data);
      }
    } catch (error) {
      onError("Error al buscar el pedido");
      console.error("Error al buscar pedido:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setSearchedPedidos([]);
    onError(null);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="search-type">Buscar por</Label>
            <div className="flex mt-1">
              <Button
                type="button"
                variant={searchType === "id" ? "default" : "outline"}
                className="rounded-r-none w-full"
                onClick={() => setSearchType("id")}
              >
                ID de Pedido
              </Button>
              <Button
                type="button"
                variant={searchType === "cliente" ? "default" : "outline"}
                className="rounded-l-none w-full"
                onClick={() => setSearchType("cliente")}
              >
                N° Cliente
              </Button>
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="search-term">
              {searchType === "id" ? "ID del Pedido" : "Número de Cliente"}
            </Label>
            <div className="relative mt-1">
              <Input
                id="search-term"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchType === "id" ? "Ej: P0001, 12345-A..." : "Ej: 10001, 20513..."}
                className="pr-10"
                disabled={isLoading}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  onClick={handleClearSearch}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-end">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !searchTerm.trim()}
            >
              {isLoading ? (
                "Buscando..."
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Lista de pedidos encontrados en la búsqueda */}
      {searchedPedidos.length > 0 && (
        <Card className="border-primary/20">
          <CardContent className="pt-4">
            <h3 className="text-sm font-medium mb-3">Resultados de la búsqueda</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">ID</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Cliente</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Finalizado</th>
                    <th scope="col" className="px-3 py-2 text-xs font-medium text-neutral-500"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {searchedPedidos.map((pedido) => {
                    // Verificar el estado del pedido
                    const esPendienteStock = pedido.estado === 'armado-pendiente-stock';
                    const estaControlando = pedido.estado === 'controlando';
                    
                    // Verificar si el pedido tiene pausas de control activas
                    const tienePausaControl = pedido.pausasActivas && pedido.pausasActivas.length > 0;
                    
                    return (
                      <tr key={pedido.id} className={`hover:bg-neutral-50 ${
                        esPendienteStock ? 'bg-amber-50' : 
                        (estaControlando && tienePausaControl) ? 'bg-orange-50' : 
                        estaControlando ? 'bg-blue-50' : 
                        ''
                      }`}>
                        <td className="px-3 py-2 text-sm font-medium text-neutral-900">
                          {pedido.pedidoId}
                          <div className="mt-1">
                            {esPendienteStock && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                <Package className="mr-1 h-3 w-3" />
                                Pendiente Stock
                              </span>
                            )}
                            {estaControlando && tienePausaControl && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                <PauseCircle className="mr-1 h-3 w-3" />
                                Control Pausado
                              </span>
                            )}
                            {estaControlando && !tienePausaControl && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Eye className="mr-1 h-3 w-3" />
                                En Control
                              </span>
                            )}
                            {pedido.estado === 'armado' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Listo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm text-neutral-700">{pedido.clienteId}</td>
                        <td className="px-3 py-2 text-sm text-neutral-700">
                          {pedido.finalizado ? formatDate(pedido.finalizado) : "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-right">
                          {pedido.estado === 'armado' ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/control/pedido/${pedido.id}`}>
                                <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                                Iniciar Control
                              </Link>
                            </Button>
                          ) : estaControlando && tienePausaControl ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/control/pedido/${pedido.id}`}>
                                <PlayCircle className="h-3.5 w-3.5 mr-1" />
                                Reanudar Control
                              </Link>
                            </Button>
                          ) : estaControlando ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/control/pedido/${pedido.id}`}>
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Continuar Control
                              </Link>
                            </Button>
                          ) : pedido.estado === 'armado-pendiente-stock' ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center text-amber-700 text-xs mb-1">
                                <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                                <span>Advertencia: Marcado como pendiente de stock</span>
                              </div>
                              <Button size="sm" variant="outline" asChild>
                                <Link to={`/control/pedido/${pedido.id}`}>
                                  <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                                  Iniciar Control
                                </Link>
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600">No disponible</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* La sección de "Pedidos pendientes de control" se ha eliminado para evitar duplicación,
         ya que esta misma sección aparece en index-page.tsx */}
    </div>
  );
}
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Pedido } from "@shared/schema";
import { Search, X, ClipboardCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Link } from "wouter";

interface SearchPedidoFormProps {
  onPedidoFound: (pedido: Pedido) => void;
  onError: (error: string | null) => void;
}

export function SearchPedidoForm({ onPedidoFound, onError }: SearchPedidoFormProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"id" | "cliente">("id");
  const [isLoading, setIsLoading] = useState(false);
  const [searchedPedidos, setSearchedPedidos] = useState<Pedido[]>([]);

  // Query para obtener todos los pedidos listos para control
  const { data: pedidosCompletados = [], isLoading: isLoadingPedidos, refetch } = useQuery({
    queryKey: ["/api/pedidos", { estado: "completado" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pedidos?estado=completado");
      if (!res.ok) return [];
      return await res.json();
    },
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
        if (res.status === 404) {
          onError("Pedido no encontrado");
        } else {
          const errorData = await res.json();
          onError(errorData.message || "Error al buscar el pedido");
        }
        return;
      }
      
      const data = await res.json();
      
      // Si es un array de pedidos
      if (Array.isArray(data)) {
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
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Estado</th>
                    <th scope="col" className="px-3 py-2 text-xs font-medium text-neutral-500"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {searchedPedidos.map((pedido) => (
                    <tr key={pedido.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 text-sm font-medium text-neutral-900">{pedido.pedidoId}</td>
                      <td className="px-3 py-2 text-sm text-neutral-700">{pedido.clienteId}</td>
                      <td className="px-3 py-2 text-sm text-neutral-700">
                        {pedido.finalizado ? formatDate(pedido.finalizado) : "-"}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full 
                          ${pedido.estado === 'completado' ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-800'}`}>
                          {pedido.estado}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-right">
                        {pedido.estado === 'completado' ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/control/pedido/${pedido.id}`}>
                              <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                              Control
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-amber-600">No disponible</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de todos los pedidos pendientes de control */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-medium mb-3">Pedidos pendientes de control</h3>
          {isLoadingPedidos ? (
            <div className="text-center py-4 text-neutral-500">Cargando pedidos...</div>
          ) : sortedPedidos.length === 0 ? (
            <div className="text-center py-4 text-neutral-500">No hay pedidos pendientes de control</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">ID</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Cliente</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Finalizado</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Items</th>
                    <th scope="col" className="px-3 py-2 text-xs font-medium text-neutral-500"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {sortedPedidos.map((pedido) => (
                    <tr key={pedido.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 text-sm font-medium text-neutral-900">{pedido.pedidoId}</td>
                      <td className="px-3 py-2 text-sm text-neutral-700">{pedido.clienteId}</td>
                      <td className="px-3 py-2 text-sm text-neutral-700">
                        {pedido.finalizado ? formatDate(pedido.finalizado) : "-"}
                      </td>
                      <td className="px-3 py-2 text-sm text-neutral-700">{pedido.items}</td>
                      <td className="px-3 py-2 text-sm text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/control/pedido/${pedido.id}`}>
                            <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                            Control
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
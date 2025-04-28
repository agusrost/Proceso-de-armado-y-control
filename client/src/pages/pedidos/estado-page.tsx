import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PedidoWithDetails } from "@shared/types";
import { getEstadoColor, getEstadoLabel, formatDate, formatTimeHM } from "@/lib/utils";
import { Eye, RefreshCw } from "lucide-react";
import PedidoDetailModal from "@/components/pedidos/pedido-detail-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function PedidosEstadoPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedPedido, setSelectedPedido] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filter states
  const [filterFecha, setFilterFecha] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterVendedor, setFilterVendedor] = useState("");
  const [filterArmador, setFilterArmador] = useState("todos");

  // Fetch armadores for the filter dropdown
  const { data: armadores = [] } = useQuery({
    queryKey: ["/api/users/armadores"],
    enabled: true,
  });

  // Actualizar estados mutation
  const actualizarEstadosMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pedidos/actualizar-estados", {});
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Estados actualizados",
        description: data.mensaje,
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar estados",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Fetch pedidos with filters
  const { data: pedidos = [], isLoading } = useQuery<PedidoWithDetails[]>({
    queryKey: [
      "/api/pedidos", 
      { fecha: filterFecha, estado: filterEstado, vendedor: filterVendedor, armadorId: filterArmador }
    ],
  });

  const openPedidoModal = (pedidoId: number) => {
    setSelectedPedido(pedidoId);
    setIsModalOpen(true);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 border-b border-neutral-200 pb-4">
          <div className="flex space-x-4">
            <button 
              className="px-4 py-2 font-medium text-neutral-600 hover:text-primary"
              onClick={() => setLocation('/pedidos/carga')}
            >
              Carga
            </button>
            <button 
              className="px-4 py-2 font-medium text-primary border-b-2 border-primary"
              onClick={() => setLocation('/pedidos/estado')}
            >
              Estado de Pedidos
            </button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Estado de Pedidos</CardTitle>
            <Button 
              variant="outline"
              className="flex items-center gap-2" 
              onClick={() => actualizarEstadosMutation.mutate()}
              disabled={actualizarEstadosMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${actualizarEstadosMutation.isPending ? 'animate-spin' : ''}`} />
              Actualizar Estados
            </Button>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <Label htmlFor="filter-fecha" className="mb-1">Fecha</Label>
                <Input 
                  id="filter-fecha" 
                  type="date" 
                  value={filterFecha}
                  onChange={(e) => setFilterFecha(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filter-estado" className="mb-1">Estado</Label>
                <Select value={filterEstado} onValueChange={setFilterEstado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="en-proceso">En Proceso</SelectItem>
                    <SelectItem value="pre-finalizado">Pre-finalizado</SelectItem>
                    <SelectItem value="armado">Armado</SelectItem>
                    <SelectItem value="completado">Completado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filter-vendedor" className="mb-1">Vendedor</Label>
                <Input 
                  id="filter-vendedor" 
                  placeholder="Filtrar por vendedor"
                  value={filterVendedor}
                  onChange={(e) => setFilterVendedor(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filter-armador" className="mb-1">Armador</Label>
                <Select value={filterArmador} onValueChange={setFilterArmador}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {armadores.map((armador) => (
                      <SelectItem key={armador.id} value={armador.id.toString()}>
                        {armador.firstName || armador.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-100">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Fecha</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ID</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Cliente</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Items</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Puntaje</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Vendedor</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Estado</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Armador</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Control</th>
                    {/* Columnas de Armado Agrupadas */}
                    <th colSpan={5} className="px-4 py-1 text-center text-xs font-medium text-neutral-800 bg-blue-100 uppercase tracking-wider">HORARIOS DE ARMADO</th>
                    {/* Columnas de Control Agrupadas */}
                    <th colSpan={5} className="px-4 py-1 text-center text-xs font-medium text-neutral-800 bg-green-100 uppercase tracking-wider">HORARIOS DE CONTROL</th>
                  </tr>
                  <tr>
                    {/* Columnas base - dejamos 9 columnas vacías para alinear */}
                    <th scope="col" className="px-4 py-2 border-t-0"></th>
                    <th scope="col" className="px-4 py-2 border-t-0"></th>
                    <th scope="col" className="px-4 py-2 border-t-0"></th>
                    <th scope="col" className="px-4 py-2 border-t-0"></th>
                    <th scope="col" className="px-4 py-2 border-t-0"></th>
                    <th scope="col" className="px-4 py-2 border-t-0"></th>
                    <th scope="col" className="px-4 py-2 border-t-0"></th>
                    <th scope="col" className="px-4 py-2 border-t-0"></th>
                    <th scope="col" className="px-4 py-2 border-t-0"></th>
                    {/* Columnas de Armado */}
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider bg-blue-50">Inicio</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider bg-blue-50">Fin</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider bg-blue-50">Pausas</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider bg-blue-50">T. Bruto</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider bg-blue-50">T. Neto</th>
                    {/* Columnas de Control */}
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider bg-green-50">Inicio</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider bg-green-50">Fin</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider bg-green-50">Pausas</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider bg-green-50">T. Bruto</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider bg-green-50">T. Neto</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={20} className="px-4 py-4 text-center">Cargando...</td>
                    </tr>
                  ) : pedidos.length === 0 ? (
                    <tr>
                      <td colSpan={20} className="px-4 py-4 text-center">No hay pedidos que coincidan con los filtros</td>
                    </tr>
                  ) : (
                    pedidos.map((pedido) => (
                      <tr key={pedido.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          {formatDate(pedido.fecha)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          {pedido.pedidoId}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          {pedido.clienteId}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          {pedido.totalProductos}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 font-semibold">
                          {pedido.puntaje || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          {pedido.vendedor}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getEstadoColor(pedido.estado)}`}>
                            {getEstadoLabel(pedido.estado)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          {pedido.armador?.firstName || pedido.armador?.username || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          {pedido.controlador?.firstName || pedido.controlador?.username || "-"}
                        </td>
                        {/* Columnas de Armado */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 bg-blue-50/40">
                          {pedido.inicio ? new Date(pedido.inicio).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) : "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 bg-blue-50/40">
                          {pedido.finalizado ? new Date(pedido.finalizado).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) : "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 bg-blue-50/40">
                          {pedido.pausas && pedido.pausas.length > 0 ? (
                            <div className="relative group">
                              <span className="underline cursor-pointer">
                                {pedido.pausas.length} {pedido.pausas.length === 1 ? 'pausa' : 'pausas'}
                              </span>
                              <div className="absolute hidden group-hover:block bg-white border border-gray-200 p-2 rounded shadow-lg z-10 w-56">
                                <div className="text-xs font-semibold mb-1 text-gray-700">Detalles de pausas:</div>
                                {pedido.pausas.map((pausa, index) => (
                                  <div key={index} className="text-xs mb-1 pb-1 border-b border-gray-100">
                                    <div><span className="font-medium">Motivo:</span> {pausa.motivo}</div>
                                    {pausa.inicio && (
                                      <div><span className="font-medium">Inicio:</span> {new Date(pausa.inicio).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</div>
                                    )}
                                    {pausa.fin && (
                                      <div><span className="font-medium">Fin:</span> {new Date(pausa.fin).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</div>
                                    )}
                                    {pausa.duracion && (
                                      <div><span className="font-medium">Duración:</span> {formatTimeHM(pausa.duracion)}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 bg-blue-50/40">
                          {pedido.tiempoBruto ? formatTimeHM(pedido.tiempoBruto) : "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 bg-blue-50/40">
                          {pedido.tiempoNeto ? formatTimeHM(pedido.tiempoNeto) : "-"}
                        </td>
                        {/* Columnas de Control */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 bg-green-50/40">
                          {pedido.controlInicio ? new Date(pedido.controlInicio).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) : "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 bg-green-50/40">
                          {pedido.controlFin ? new Date(pedido.controlFin).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) : "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 bg-green-50/40">
                          {pedido.controlPausas && pedido.controlPausas.length > 0 ? (
                            <div className="relative group">
                              <span className="underline cursor-pointer">
                                {pedido.controlPausas.length} {pedido.controlPausas.length === 1 ? 'pausa' : 'pausas'}
                              </span>
                              <div className="absolute hidden group-hover:block bg-white border border-gray-200 p-2 rounded shadow-lg z-10 w-56">
                                <div className="text-xs font-semibold mb-1 text-gray-700">Detalles de pausas:</div>
                                {pedido.controlPausas.map((pausa, index) => (
                                  <div key={index} className="text-xs mb-1 pb-1 border-b border-gray-100">
                                    <div><span className="font-medium">Motivo:</span> {pausa.motivo}</div>
                                    {pausa.inicio && (
                                      <div><span className="font-medium">Inicio:</span> {new Date(pausa.inicio).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</div>
                                    )}
                                    {pausa.fin && (
                                      <div><span className="font-medium">Fin:</span> {new Date(pausa.fin).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</div>
                                    )}
                                    {pausa.duracion && (
                                      <div><span className="font-medium">Duración:</span> {formatTimeHM(pausa.duracion)}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 bg-green-50/40">
                          {pedido.controlTiempo || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 bg-green-50/40">
                          {pedido.controlTiempoNeto || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          <button 
                            className="text-primary hover:text-primary/90 font-medium flex items-center gap-1"
                            onClick={() => openPedidoModal(pedido.id)}
                          >
                            <Eye className="h-4 w-4" />
                            VER
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {selectedPedido && (
          <PedidoDetailModal
            pedidoId={selectedPedido}
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          />
        )}
      </div>
    </MainLayout>
  );
}

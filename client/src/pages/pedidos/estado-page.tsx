import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PedidoWithDetails } from "@shared/types";
import { getEstadoColor, getEstadoLabel, formatDate, formatTimeHM } from "@/lib/utils";
import { Eye } from "lucide-react";
import PedidoDetailModal from "@/components/pedidos/pedido-detail-modal";

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
          <CardHeader>
            <CardTitle>Estado de Pedidos</CardTitle>
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
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Hora Inicio</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Hora Fin</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Tiempo Bruto</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Pausas</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Tiempo Neto</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-4 text-center">Cargando...</td>
                    </tr>
                  ) : pedidos.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-4 text-center">No hay pedidos que coincidan con los filtros</td>
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
                          {pedido.inicio ? new Date(pedido.inicio).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) : "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          {pedido.finalizado ? new Date(pedido.finalizado).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) : "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          {pedido.tiempoBruto ? formatTimeHM(pedido.tiempoBruto) : "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          {pedido.pausas?.length || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          {pedido.tiempoNeto ? formatTimeHM(pedido.tiempoNeto) : "-"}
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

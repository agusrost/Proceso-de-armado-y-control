import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StockSolicitudWithDetails } from "@shared/types";
import { getEstadoColor, getEstadoLabel, formatDate } from "@/lib/utils";
import { Plus, Eye, Check, XCircle, History } from "lucide-react";
import TransferenciaModal from "@/components/stock/transferencia-modal";
import SolicitudDetailModal from "@/components/stock/solicitud-detail-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Función para extraer información del cliente desde el motivo
const extractClienteInfo = (motivo: string) => {
  // Primero intentamos encontrar "Codigo: XXXX" que es el identificador del cliente
  const clienteMatch = motivo.match(/[Cc][oó]digo:?\s+(\d+)/i);
  if (clienteMatch) {
    return clienteMatch[1];
  }
  
  // Si no encontramos el patrón exacto, intentamos otros formatos comunes
  const altClienteMatch = motivo.match(/Cliente(?:\s+Nro)?[:\s]+(\d+)/i);
  return altClienteMatch ? altClienteMatch[1] : null;
};

// Función para extraer información del pedido desde el motivo
const extractPedidoInfo = (motivo: string) => {
  // Primero intentamos encontrar "Pedido: XXX" que es el identificador del pedido
  const pedidoMatch = motivo.match(/[Pp]edido:?\s+(\d+)/i);
  if (pedidoMatch) {
    return pedidoMatch[1];
  }
  
  // Si no encontramos el patrón exacto, intentamos otros formatos comunes
  const altPedidoMatch = motivo.match(/P(\d+)/i);
  return altPedidoMatch ? altPedidoMatch[1] : null;
};

export default function StockPage() {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSolicitudId, setSelectedSolicitudId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("solicitudes");
  
  // Filter states
  const [filterFecha, setFilterFecha] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterMotivo, setFilterMotivo] = useState("");
  const [filterSolicitado, setFilterSolicitado] = useState("");

  // Fetch stock solicitudes with filters for active tab
  const { data: solicitudes = [], isLoading } = useQuery<StockSolicitudWithDetails[]>({
    queryKey: [
      "/api/stock/activas", 
      { 
        fecha: filterFecha, 
        estado: filterEstado === "todos" ? "" : filterEstado, 
        motivo: filterMotivo, 
        solicitadoPor: filterSolicitado 
      }
    ],
    enabled: activeTab === "solicitudes",
  });
  
  // Fetch stock historial
  const { data: historialSolicitudes = [], isLoading: isLoadingHistorial } = useQuery<StockSolicitudWithDetails[]>({
    queryKey: ["/api/stock/historial"],
    enabled: activeTab === "historial",
  });

  // Update solicitud estado mutation
  const updateEstadoMutation = useMutation({
    mutationFn: async ({ id, estado }: { id: number, estado: string }) => {
      const res = await apiRequest("PUT", `/api/stock/${id}/estado`, { estado });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Estado actualizado",
        description: "El estado de la solicitud ha sido actualizado correctamente",
      });
      // Invalidar ambos endpoints para asegurar que los datos se actualicen
      queryClient.invalidateQueries({ queryKey: ["/api/stock/activas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock/historial"] });
      
      // También invalidar pedidos por si un pedido cambió de estado
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar estado",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEstadoChange = (id: number, estado: string) => {
    updateEstadoMutation.mutate({ id, estado });
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Gestión de Stock</h2>
          <Button 
            className="flex items-center gap-2"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Transferencia</span>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="solicitudes" className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Solicitudes Activas
            </TabsTrigger>
            <TabsTrigger value="historial" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="solicitudes">
            <Card>
              <CardContent className="pt-6">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <Label htmlFor="stock-filter-fecha" className="mb-1">Fecha</Label>
                    <Input 
                      id="stock-filter-fecha" 
                      type="date" 
                      value={filterFecha}
                      onChange={(e) => setFilterFecha(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="stock-filter-estado" className="mb-1">Estado</Label>
                    <Select value={filterEstado} onValueChange={setFilterEstado}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="realizado">Realizado</SelectItem>
                        <SelectItem value="no-hay">No hay, realizar NC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="stock-filter-motivo" className="mb-1">Motivo</Label>
                    <Input 
                      id="stock-filter-motivo" 
                      placeholder="Filtrar por motivo"
                      value={filterMotivo}
                      onChange={(e) => setFilterMotivo(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="stock-filter-solicita" className="mb-1">Solicitado por</Label>
                    <Input 
                      id="stock-filter-solicita" 
                      placeholder="Filtrar por solicitante"
                      value={filterSolicitado}
                      onChange={(e) => setFilterSolicitado(e.target.value)}
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-100">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Fecha</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Horario</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Código</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Cantidad</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Cliente</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Pedido</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Motivo</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Estado</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Solicitado por</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Realizado por</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-200">
                      {isLoading ? (
                        <tr>
                          <td colSpan={11} className="px-4 py-4 text-center">Cargando...</td>
                        </tr>
                      ) : solicitudes.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-4 py-4 text-center">No hay solicitudes que coincidan con los filtros</td>
                        </tr>
                      ) : (
                        solicitudes.map((solicitud) => (
                          <tr key={solicitud.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {formatDate(solicitud.fecha)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {new Date(solicitud.horario).toLocaleTimeString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-neutral-800">
                              {solicitud.codigo}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {solicitud.cantidad}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 font-medium">
                              {extractClienteInfo(solicitud.motivo) || "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 font-medium">
                              {extractPedidoInfo(solicitud.motivo) || "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {solicitud.motivo}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getEstadoColor(solicitud.estado)}`}>
                                {getEstadoLabel(solicitud.estado)}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {solicitud.solicitadoPor ? (
                                solicitud.solicitanteUser?.firstName || 
                                solicitud.solicitanteUser?.username || 
                                solicitud.solicitante || 
                                "-"
                              ) : (
                                solicitud.solicitante || "-"
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {solicitud.realizadoPor ? (
                                solicitud.realizadorUser?.firstName || 
                                solicitud.realizadorUser?.username || 
                                "-"
                              ) : "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {solicitud.estado === 'pendiente' ? (
                                <div className="flex space-x-2">
                                  <button 
                                    className="text-green-600 hover:text-green-800 font-medium flex items-center gap-1"
                                    onClick={() => handleEstadoChange(solicitud.id, 'realizado')}
                                  >
                                    <Check className="h-4 w-4" />
                                    Realizado
                                  </button>
                                  <button 
                                    className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                                    onClick={() => handleEstadoChange(solicitud.id, 'no-hay')}
                                  >
                                    <XCircle className="h-4 w-4" />
                                    No hay
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  className="text-primary hover:text-primary/90 font-medium flex items-center gap-1"
                                  onClick={() => {
                                    setSelectedSolicitudId(solicitud.id);
                                    setIsDetailModalOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                  Ver
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="historial">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Solicitudes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-100">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Fecha</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Horario</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Código</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Cantidad</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Cliente</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Pedido</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Motivo</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Estado</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Solicitado por</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Realizado por</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-200">
                      {isLoadingHistorial ? (
                        <tr>
                          <td colSpan={11} className="px-4 py-4 text-center">Cargando...</td>
                        </tr>
                      ) : historialSolicitudes.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-4 py-4 text-center">No hay solicitudes en el historial</td>
                        </tr>
                      ) : (
                        historialSolicitudes.map((solicitud) => (
                          <tr key={solicitud.id} className="bg-white">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {formatDate(solicitud.fecha)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {new Date(solicitud.horario).toLocaleTimeString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-neutral-800">
                              {solicitud.codigo}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {solicitud.cantidad}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 font-medium">
                              {extractClienteInfo(solicitud.motivo) || "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800 font-medium">
                              {extractPedidoInfo(solicitud.motivo) || "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {solicitud.motivo}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getEstadoColor(solicitud.estado)}`}>
                                {getEstadoLabel(solicitud.estado)}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {solicitud.solicitadoPor ? (
                                solicitud.solicitanteUser?.firstName || 
                                solicitud.solicitanteUser?.username || 
                                solicitud.solicitante || 
                                "-"
                              ) : (
                                solicitud.solicitante || "-"
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              {solicitud.realizadoPor ? (
                                solicitud.realizadorUser?.firstName || 
                                solicitud.realizadorUser?.username || 
                                "-"
                              ) : "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                              <button 
                                className="text-primary hover:text-primary/90 font-medium flex items-center gap-1"
                                onClick={() => {
                                  setSelectedSolicitudId(solicitud.id);
                                  setIsDetailModalOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                                Ver
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <TransferenciaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      {selectedSolicitudId && (
        <SolicitudDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          solicitudId={selectedSolicitudId}
        />
      )}
    </MainLayout>
  );
}
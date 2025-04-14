import { useState } from "react";
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
import { Plus, Eye, Check, XCircle } from "lucide-react";
import TransferenciaModal from "@/components/stock/transferencia-modal";

export default function StockPage() {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filter states
  const [filterFecha, setFilterFecha] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterMotivo, setFilterMotivo] = useState("");
  const [filterSolicitado, setFilterSolicitado] = useState("");

  // Fetch stock solicitudes with filters
  const { data: solicitudes = [], isLoading } = useQuery<StockSolicitudWithDetails[]>({
    queryKey: [
      "/api/stock", 
      { fecha: filterFecha, estado: filterEstado, motivo: filterMotivo, solicitadoPor: filterSolicitado }
    ],
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
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
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
                    <SelectItem value="">Todos</SelectItem>
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
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Motivo</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Estado</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Solicitado por</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-4 text-center">Cargando...</td>
                    </tr>
                  ) : solicitudes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-4 text-center">No hay solicitudes que coincidan con los filtros</td>
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
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          {solicitud.motivo}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getEstadoColor(solicitud.estado)}`}>
                            {getEstadoLabel(solicitud.estado)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          {solicitud.solicitante?.firstName || solicitud.solicitante?.username || "-"}
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
                            <button className="text-primary hover:text-primary/90 font-medium flex items-center gap-1">
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

        <TransferenciaModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    </MainLayout>
  );
}

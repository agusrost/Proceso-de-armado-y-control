import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pedido, User } from "@shared/schema";
import { getEstadoColor, getEstadoLabel, formatDate } from "@/lib/utils";
import { 
  BarChart3, 
  User as UserIcon, 
  Package, 
  Timer 
} from "lucide-react";

export default function ControlPage() {
  const { toast } = useToast();
  const [filterFecha, setFilterFecha] = useState("");
  const [filterArmador, setFilterArmador] = useState("");

  // Fetch armadores for the filter dropdown
  const { data: armadores = [] } = useQuery<User[]>({
    queryKey: ["/api/users/armadores"],
    enabled: true,
  });

  // Fetch pedidos for statistics
  const { data: pedidos = [], isLoading: isLoadingPedidos } = useQuery<Pedido[]>({
    queryKey: [
      "/api/pedidos", 
      { fecha: filterFecha, armadorId: filterArmador }
    ],
  });

  // Calculate statistics
  const totalPedidos = pedidos.length;
  const pedidosCompletados = pedidos.filter(p => p.estado === 'completado').length;
  const pedidosPendientes = pedidos.filter(p => p.estado === 'pendiente').length;
  const pedidosEnProceso = pedidos.filter(p => p.estado === 'en-proceso').length;
  
  // Group pedidos by armador
  const pedidosByArmador: Record<string, { 
    armadorName: string, 
    completados: number, 
    enProceso: number, 
    tiempoPromedio: string 
  }> = {};
  
  // Calculate time statistics
  let tiempoPromedioGlobal = "00:00";
  let totalTiempoMinutos = 0;
  let countCompletadosConTiempo = 0;

  pedidos.forEach(pedido => {
    // Skip pedidos without armador
    if (!pedido.armadorId) return;
    
    // Find armador name
    const armador = armadores.find(a => a.id === pedido.armadorId);
    const armadorName = armador ? (armador.firstName || armador.username) : `Armador ID ${pedido.armadorId}`;
    
    // Initialize if not exists
    if (!pedidosByArmador[pedido.armadorId]) {
      pedidosByArmador[pedido.armadorId] = {
        armadorName,
        completados: 0,
        enProceso: 0,
        tiempoPromedio: "00:00"
      };
    }
    
    // Count by status
    if (pedido.estado === 'completado') {
      pedidosByArmador[pedido.armadorId].completados++;
      
      // Calculate tiempo promedio if available
      if (pedido.tiempoNeto) {
        const [hours, minutes] = pedido.tiempoNeto.split(':').map(Number);
        const tiempoMinutos = hours * 60 + minutes;
        
        totalTiempoMinutos += tiempoMinutos;
        countCompletadosConTiempo++;
      }
    } else if (pedido.estado === 'en-proceso') {
      pedidosByArmador[pedido.armadorId].enProceso++;
    }
  });
  
  // Calculate tiempo promedio global
  if (countCompletadosConTiempo > 0) {
    const promedioMinutos = Math.floor(totalTiempoMinutos / countCompletadosConTiempo);
    const hours = Math.floor(promedioMinutos / 60);
    const minutes = promedioMinutos % 60;
    tiempoPromedioGlobal = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold mb-6">Panel de Control</h1>
        
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label htmlFor="filter-armador" className="mb-1">Armador</Label>
                <Select value={filterArmador} onValueChange={setFilterArmador}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {armadores.map((armador) => (
                      <SelectItem key={armador.id} value={armador.id.toString()}>
                        {armador.firstName || armador.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500 mb-1">Total Pedidos</p>
                  <p className="text-3xl font-bold">{totalPedidos}</p>
                </div>
                <BarChart3 className="h-10 w-10 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500 mb-1">Completados</p>
                  <p className="text-3xl font-bold">{pedidosCompletados}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                  <Check className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500 mb-1">En Proceso</p>
                  <p className="text-3xl font-bold">{pedidosEnProceso}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                  <Package className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500 mb-1">Tiempo Promedio</p>
                  <p className="text-3xl font-bold">{tiempoPromedioGlobal}</p>
                </div>
                <Timer className="h-10 w-10 text-purple-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Armadores Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Rendimiento de Armadores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-100">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Armador</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Pedidos Completados</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">En Proceso</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {isLoadingPedidos ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center">Cargando...</td>
                    </tr>
                  ) : Object.keys(pedidosByArmador).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center">No hay datos para mostrar</td>
                    </tr>
                  ) : (
                    Object.entries(pedidosByArmador).map(([armadorId, data]) => (
                      <tr key={armadorId}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center">
                              <UserIcon className="h-4 w-4 text-neutral-500" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-neutral-900">
                                {data.armadorName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {data.completados}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-800">
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {data.enProceso}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

// Imported component that wasn't defined in the imports
function Check(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

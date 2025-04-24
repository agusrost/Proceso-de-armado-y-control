import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pedido, User } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { 
  Search, 
  FileX, 
  ClipboardCheck, 
  X,
  Clock,
  Check,
  AlertTriangle
} from "lucide-react";
import { Link } from "wouter";
import { ControlNav } from "@/components/control/control-nav";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ControlHistoricoWithDetails as ControlHistorico } from "@shared/types";

export default function ControlHistorialPage() {
  const { toast } = useToast();
  
  // Estado para filtros
  const [filtroFecha, setFiltroFecha] = useState<string>("");
  const [filtroResultado, setFiltroResultado] = useState<string>("");
  const [mostrarSoloFinalizados, setMostrarSoloFinalizados] = useState<boolean>(true);
  
  // Query para obtener lista de controles
  const { 
    data: historicoControlesRaw = [], 
    isLoading: isLoadingHistorico,
    refetch
  } = useQuery<ControlHistorico[]>({
    queryKey: ["/api/control/historial"],
    queryFn: async () => {
      // Construir parámetros de filtro
      const params = new URLSearchParams();
      if (filtroFecha) params.append("fecha", filtroFecha);
      if (filtroResultado) params.append("resultado", filtroResultado);
      
      const res = await apiRequest("GET", `/api/control/historial?${params.toString()}`);
      if (!res.ok) throw new Error("Error al cargar historial");
      return res.json();
    },
  });
  
  // Filtrar solo los controles que tienen fecha de fin (están finalizados)
  const historicoControles = useMemo(() => {
    return mostrarSoloFinalizados 
      ? historicoControlesRaw.filter(control => control.fin !== null)
      : historicoControlesRaw;
  }, [historicoControlesRaw, mostrarSoloFinalizados]);
  
  // Aplicar filtros
  const handleAplicarFiltros = () => {
    refetch();
  };
  
  // Resetear filtros
  const handleResetearFiltros = () => {
    setFiltroFecha("");
    setFiltroResultado("");
    setTimeout(() => {
      refetch();
    }, 100);
  };
  
  // Formatear resultado
  const formatResultado = (resultado: string) => {
    switch (resultado) {
      case 'completo':
        return { 
          text: 'Completo', 
          className: 'bg-green-100 text-green-800 hover:bg-green-200',
          icon: <Check className="mr-1 h-3 w-3" />
        };
      case 'faltantes':
        return { 
          text: 'Faltantes', 
          className: 'bg-red-100 text-red-800 hover:bg-red-200',
          icon: <X className="mr-1 h-3 w-3" />
        };
      case 'excedentes':
        return { 
          text: 'Excedentes', 
          className: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
          icon: <AlertTriangle className="mr-1 h-3 w-3" />
        };
      case 'en-proceso':
        return { 
          text: 'En Proceso', 
          className: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
          icon: <Clock className="mr-1 h-3 w-3" />
        };
      default:
        return { 
          text: resultado, 
          className: '',
          icon: null
        };
    }
  };
  
  // Filtrar registros
  const historialFiltrado = historicoControles;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Historial de Control</h1>
        </div>
        
        <ControlNav />
        
        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>
              Filtra el historial de controles por fecha o resultado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="filtro-fecha">Fecha</Label>
                <Input
                  id="filtro-fecha"
                  type="date"
                  value={filtroFecha}
                  onChange={(e) => setFiltroFecha(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="filtro-resultado">Resultado</Label>
                <Select value={filtroResultado} onValueChange={setFiltroResultado}>
                  <SelectTrigger id="filtro-resultado" className="mt-1">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="completo">Completo</SelectItem>
                    <SelectItem value="faltantes">Faltantes</SelectItem>
                    <SelectItem value="excedentes">Excedentes</SelectItem>
                    <SelectItem value="en-proceso">En Proceso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col justify-between">
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="checkbox"
                    id="solo-finalizados"
                    checked={mostrarSoloFinalizados}
                    onChange={(e) => setMostrarSoloFinalizados(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="solo-finalizados" className="text-sm font-medium leading-none">
                    Solo mostrar controles finalizados
                  </Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleAplicarFiltros} 
                    className="flex-1"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Aplicar Filtros
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={handleResetearFiltros}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Listado de historial */}
        <Card>
          <CardHeader>
            <CardTitle>Listado de Controles</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingHistorico ? (
              <div className="text-center py-4">Cargando historial...</div>
            ) : historialFiltrado.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center">
                <FileX className="h-12 w-12 text-neutral-300 mb-4" />
                <p className="text-neutral-500">No se encontraron registros de control</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-100">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ID</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Pedido</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Cliente</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Fecha</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Controlador</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Resultado</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Tiempo</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {historialFiltrado.map((control) => {
                      const resultado = formatResultado(control.resultado);
                      
                      return (
                        <tr key={control.id}>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-neutral-500">
                            #{control.id}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-neutral-900">
                            {control.pedido?.pedidoId || `#${control.pedidoId}`}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                            {control.pedido?.clienteId || "-"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                            {formatDate(control.fecha)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                            {control.controlador ? 
                              (control.controlador.firstName || control.controlador.username) : 
                              `Usuario #${control.controladoPor}`
                            }
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge 
                              variant="outline" 
                              className={resultado.className}
                            >
                              {resultado.icon}
                              {resultado.text}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                            {control.tiempoTotal || "-"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="h-8 w-8 p-0"
                            >
                              <Link to={`/control/historial/${control.id}`}>
                                <span className="sr-only">Ver detalles</span>
                                <Search className="h-4 w-4" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
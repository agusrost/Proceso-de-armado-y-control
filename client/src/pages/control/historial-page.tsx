import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { ArrowLeft, Search, FileText, Clock, User as UserIcon } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { User } from "@shared/schema";
import { ControlHistoricoWithDetails, ControlDetalleWithProducto } from "@shared/types";

export default function ControlHistorialPage() {
  const { toast } = useToast();
  const [filterFecha, setFilterFecha] = useState("");
  const [filterControl, setFilterControl] = useState<string>("");
  const [filterResultado, setFilterResultado] = useState<string>("");
  
  // Cargar usuarios para el filtro
  const { data: usuarios = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Cargar historial de controles con filtros
  const { data: historialControles = [], isLoading } = useQuery<ControlHistoricoWithDetails[]>({
    queryKey: [
      "/api/control/historial", 
      { 
        fecha: filterFecha, 
        controladoPor: filterControl, 
        resultado: filterResultado
      }
    ],
  });

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <Button variant="outline" size="icon" asChild className="mr-4">
            <Link to="/control">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Historial de Controles</h1>
        </div>
        
        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="filter-fecha">Fecha</Label>
                <Input 
                  id="filter-fecha" 
                  type="date" 
                  value={filterFecha}
                  onChange={(e) => setFilterFecha(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filter-control">Controlador</Label>
                <Select value={filterControl} onValueChange={setFilterControl}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {usuarios.map((usuario) => (
                      <SelectItem key={usuario.id} value={usuario.id.toString()}>
                        {usuario.firstName || usuario.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filter-resultado">Resultado</Label>
                <Select value={filterResultado} onValueChange={setFilterResultado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="completo">Completo</SelectItem>
                    <SelectItem value="faltantes">Faltantes</SelectItem>
                    <SelectItem value="excedentes">Excedentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Lista de controles */}
        <Card>
          <CardHeader>
            <CardTitle>Registros de Control</CardTitle>
            <CardDescription>
              Historial de controles realizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">Cargando...</div>
            ) : historialControles.length === 0 ? (
              <div className="text-center py-4 text-neutral-500">
                No hay registros de controles que coincidan con los filtros
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-100">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Pedido</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Fecha</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Controlador</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Tiempo</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Resultado</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {historialControles.map((control) => (
                      <tr key={control.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-neutral-900">
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-2 text-neutral-400" />
                            {control.pedido?.pedidoId || `Pedido #${control.pedidoId}`}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2 text-neutral-400" />
                            {formatDateTime(control.inicio)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                          <div className="flex items-center">
                            <UserIcon className="h-4 w-4 mr-2 text-neutral-400" />
                            {control.controlador
                              ? (control.controlador.firstName || control.controlador.username)
                              : `Usuario #${control.controladoPor}`}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                          {control.tiempoTotal || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span 
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              control.resultado === 'completo' 
                                ? 'bg-green-100 text-green-800' 
                                : control.resultado === 'faltantes'
                                ? 'bg-red-100 text-red-800'
                                : control.resultado === 'excedentes'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {control.resultado === 'completo' 
                              ? 'Completo' 
                              : control.resultado === 'faltantes'
                              ? 'Faltantes'
                              : control.resultado === 'excedentes'
                              ? 'Excedentes'
                              : control.resultado === 'en-proceso'
                              ? 'En Proceso'
                              : control.resultado}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/control/historial/${control.id}`}>
                              <Search className="h-4 w-4" />
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
    </MainLayout>
  );
}
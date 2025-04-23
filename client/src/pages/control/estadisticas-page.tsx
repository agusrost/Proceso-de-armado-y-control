import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { ControlNav } from "@/components/control/control-nav";
import { apiRequest } from "@/lib/queryClient";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ControlHistoricoWithDetails } from "@shared/types";
import { User } from "@shared/schema";
import { formatDate } from "@/lib/utils";

// Colores para los gráficos
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function ControlEstadisticasPage() {
  const { toast } = useToast();
  
  // Query para obtener historial de controles
  const { 
    data: historicoControles = [], 
    isLoading: isLoadingHistorico
  } = useQuery<ControlHistoricoWithDetails[]>({
    queryKey: ["/api/control/historial"],
  });
  
  // Query para obtener usuarios controladores
  const { 
    data: usuarios = [], 
    isLoading: isLoadingUsuarios
  } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  
  // Procesar datos para gráficos
  const procesarDatosResultados = () => {
    const resultados: Record<string, number> = {
      'completo': 0,
      'faltantes': 0,
      'excedentes': 0,
      'en-proceso': 0
    };
    
    historicoControles.forEach(control => {
      if (control.resultado && resultados[control.resultado] !== undefined) {
        resultados[control.resultado]++;
      }
    });
    
    return Object.keys(resultados).map(key => ({
      nombre: key === 'completo' ? 'Completo' : 
              key === 'faltantes' ? 'Faltantes' : 
              key === 'excedentes' ? 'Excedentes' : 'En proceso',
      valor: resultados[key]
    }));
  };
  
  const procesarDatosControladores = () => {
    const controladores: Record<number, { nombre: string, controles: number }> = {};
    
    historicoControles.forEach(control => {
      if (control.controladoPor) {
        if (!controladores[control.controladoPor]) {
          // Buscar nombre del controlador
          const usuario = usuarios.find(u => u.id === control.controladoPor);
          controladores[control.controladoPor] = { 
            nombre: usuario ? (usuario.firstName || usuario.username) : `Usuario #${control.controladoPor}`, 
            controles: 0 
          };
        }
        controladores[control.controladoPor].controles++;
      }
    });
    
    return Object.values(controladores);
  };
  
  const procesarDatosTiempos = () => {
    const datos = historicoControles
      .filter(control => control.tiempoTotal) // Solo los que tienen tiempo registrado
      .map(control => {
        // Convertir el tiempo (formato "HH:MM:SS") a segundos
        const tiempoPartes = (control.tiempoTotal || "00:00:00").split(':');
        const segundos = parseInt(tiempoPartes[0]) * 3600 + parseInt(tiempoPartes[1]) * 60 + parseInt(tiempoPartes[2]);
        
        return {
          id: control.id,
          pedidoId: control.pedido?.pedidoId || `#${control.pedidoId}`,
          tiempoSegundos: segundos,
          tiempoFormateado: control.tiempoTotal
        };
      })
      .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos) // Ordenar por tiempo
      .slice(0, 10); // Top 10
    
    return datos;
  };
  
  // Obtener datos procesados
  const datosResultados = procesarDatosResultados();
  const datosControladores = procesarDatosControladores();
  const datosTiempos = procesarDatosTiempos();
  
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Estadísticas de Control</h1>
        </div>
        
        <ControlNav />
        
        {/* Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Total de Controles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{historicoControles.length}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Controles Completos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-green-600">
                {historicoControles.filter(c => c.resultado === 'completo').length}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Controles con Faltantes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-red-600">
                {historicoControles.filter(c => c.resultado === 'faltantes').length}
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Gráficos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Gráfico de Resultados */}
          <Card>
            <CardHeader>
              <CardTitle>Resultados de Control</CardTitle>
              <CardDescription>
                Distribución de resultados de controles realizados
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {isLoadingHistorico ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-neutral-500">Cargando datos...</p>
                </div>
              ) : datosResultados.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-neutral-500">No hay datos disponibles</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={datosResultados}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ nombre, valor, percent }) => `${nombre}: ${valor} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="valor"
                      nameKey="nombre"
                    >
                      {datosResultados.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          
          {/* Gráfico de Controladores */}
          <Card>
            <CardHeader>
              <CardTitle>Controles por Controlador</CardTitle>
              <CardDescription>
                Número de controles realizados por cada controlador
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {isLoadingHistorico || isLoadingUsuarios ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-neutral-500">Cargando datos...</p>
                </div>
              ) : datosControladores.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-neutral-500">No hay datos disponibles</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={datosControladores}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 60,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="nombre" 
                      angle={-45} 
                      textAnchor="end"
                      height={60}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="controles" name="Controles" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Tiempos de Control */}
        <Card>
          <CardHeader>
            <CardTitle>Tiempos de Control</CardTitle>
            <CardDescription>
              Pedidos ordenados por tiempo de control (menor a mayor)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoadingHistorico ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-neutral-500">Cargando datos...</p>
              </div>
            ) : datosTiempos.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-neutral-500">No hay datos de tiempos disponibles</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={datosTiempos}
                  layout="vertical"
                  margin={{
                    top: 20,
                    right: 30,
                    left: 60,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="pedidoId" 
                    type="category" 
                    tick={{ fontSize: 12 }}
                    width={50}
                  />
                  <Tooltip 
                    formatter={(value, name) => {
                      const seconds = value as number;
                      const hours = Math.floor(seconds / 3600);
                      const minutes = Math.floor((seconds % 3600) / 60);
                      const secs = seconds % 60;
                      return [`${hours}h ${minutes}m ${secs}s`, 'Tiempo de Control'];
                    }}
                  />
                  <Bar dataKey="tiempoSegundos" name="Tiempo" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { parsePedidoText } from "@/components/pedidos/parse-pedido";
import { ParsedPedido } from "@shared/types";

export default function PedidosCargaPage() {
  const [, setLocation] = useLocation();
  const [pedidoText, setPedidoText] = useState("");
  const [armadorId, setArmadorId] = useState("aleatorio");
  const [parsedPedido, setParsedPedido] = useState<ParsedPedido | null>(null);
  const { toast } = useToast();

  // Fetch armadores for the dropdown
  const { data: armadores = [] } = useQuery({
    queryKey: ["/api/users/armadores"],
    enabled: true,
  });

  // Parse the pedido text in real-time
  const handlePedidoTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPedidoText(text);
    
    if (text.trim()) {
      try {
        const parsedData = parsePedidoText(text);
        setParsedPedido(parsedData);
      } catch (error) {
        setParsedPedido(null);
      }
    } else {
      setParsedPedido(null);
    }
  };

  // Create pedido mutation
  const createPedidoMutation = useMutation({
    mutationFn: async () => {
      if (!parsedPedido) throw new Error("No hay datos de pedido para procesar");
      
      // Generar un ID único para el pedido si no tiene uno o si es solo un número
      let uniquePedidoId;
      
      if (!parsedPedido.pedidoId) {
        // Si no hay ID, generar uno con formato PED y número
        uniquePedidoId = `PED-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      } else if (/^\d+$/.test(parsedPedido.pedidoId)) {
        // Si es solo un número, añadir un prefijo P y formatear con ceros a la izquierda
        uniquePedidoId = `P${parsedPedido.pedidoId.toString().padStart(4, '0')}`;
      } else {
        // Si ya tiene un formato con letras, usarlo como está
        uniquePedidoId = parsedPedido.pedidoId;
      }
      
      const pedidoData = {
        pedidoId: uniquePedidoId,
        clienteId: parsedPedido.clienteId,
        fecha: new Date().toISOString(), // Usar ISO string para fechas
        items: parsedPedido.items,
        totalProductos: parsedPedido.totalProductos,
        vendedor: parsedPedido.vendedor,
        estado: "pendiente",
        puntaje: parsedPedido.puntaje,
        armadorId: armadorId !== "aleatorio" ? parseInt(armadorId) : null, // Usar null en lugar de undefined
        rawText: pedidoText,
        productos: parsedPedido.productos.map(p => ({
          ...p,
          pedidoId: undefined, // Evitar enviar pedidoId para cada producto, se asigna en el servidor
        })),
      };
      
      console.log("Enviando datos de pedido:", pedidoData);
      
      try {
        const res = await apiRequest("POST", "/api/pedidos", pedidoData);
        
        // Verificar si la respuesta es JSON
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error("La respuesta no es JSON:", contentType);
          const text = await res.text();
          console.error("Contenido de respuesta:", text);
          throw new Error("La respuesta del servidor no tiene el formato esperado");
        }
        
        return await res.json();
      } catch (error) {
        console.error("Error al crear pedido:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Pedido ingresado",
        description: "El pedido ha sido ingresado correctamente",
      });
      
      // Clear form and navigate to estado page
      setPedidoText("");
      setParsedPedido(null);
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos"] });
      setLocation("/pedidos/estado");
    },
    onError: (error: Error) => {
      console.error("Error en mutation de pedido:", error);
      toast({
        title: "Error al ingresar el pedido",
        description: error.message || "Ocurrió un error al procesar el pedido",
        variant: "destructive",
      });
    },
  });

  const handleIngresarPedido = () => {
    if (!pedidoText.trim()) {
      toast({
        title: "Campo vacío",
        description: "Por favor ingrese el texto del pedido",
        variant: "destructive",
      });
      return;
    }
    
    if (!parsedPedido) {
      toast({
        title: "Error de formato",
        description: "No se pudo procesar el texto del pedido. Verifique el formato.",
        variant: "destructive",
      });
      return;
    }
    
    createPedidoMutation.mutate();
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 border-b border-neutral-200 pb-4">
          <div className="flex space-x-4">
            <button 
              className="px-4 py-2 font-medium text-primary border-b-2 border-primary"
              onClick={() => setLocation('/pedidos/carga')}
            >
              Carga
            </button>
            <button 
              className="px-4 py-2 font-medium text-neutral-600 hover:text-primary"
              onClick={() => setLocation('/pedidos/estado')}
            >
              Estado de Pedidos
            </button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Carga de Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label htmlFor="pedido-text" className="mb-2">Texto del Pedido</Label>
              <Textarea 
                id="pedido-text"
                placeholder="Pegue el texto del pedido aquí..."
                rows={10}
                value={pedidoText}
                onChange={handlePedidoTextChange}
              />
            </div>

            {parsedPedido && (
              <div className="mb-4 p-4 bg-neutral-100 rounded-md">
                <h3 className="font-semibold mb-2">Previsualización</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p><span className="font-medium">Cliente:</span> <span>{parsedPedido.clienteId}</span></p>
                    <p><span className="font-medium">Pedido:</span> <span>{parsedPedido.pedidoId || "Auto"}</span></p>
                    <p><span className="font-medium">Vendedor:</span> <span>{parsedPedido.vendedor}</span></p>
                  </div>
                  <div>
                    <p><span className="font-medium">Items:</span> <span className="font-semibold">{parsedPedido.items}</span></p>
                    <p><span className="font-medium">Total Productos:</span> <span className="font-semibold">{parsedPedido.totalProductos}</span></p>
                    <p><span className="font-medium">Puntaje:</span> <span className="font-semibold">{parsedPedido.puntaje}</span></p>
                  </div>
                </div>
                
                {parsedPedido.productos && parsedPedido.productos.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Productos ({parsedPedido.productos.length})</h4>
                    <div className="max-h-40 overflow-y-auto">
                      <table className="min-w-full divide-y divide-neutral-200">
                        <thead className="bg-neutral-200">
                          <tr>
                            <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Código</th>
                            <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Cant.</th>
                            <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Ubicación</th>
                            <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Descripción</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-neutral-200">
                          {parsedPedido.productos.map((producto, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-neutral-50' : 'bg-white'}>
                              <td className="px-2 py-1 text-xs font-mono">{producto.codigo}</td>
                              <td className="px-2 py-1 text-xs">{producto.cantidad}</td>
                              <td className="px-2 py-1 text-xs font-medium text-blue-600">{producto.ubicacion || "-"}</td>
                              <td className="px-2 py-1 text-xs truncate max-w-xs">{producto.descripcion}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mb-4">
              <Label htmlFor="select-armador" className="mb-2">Asignar Armador</Label>
              <div className="flex">
                <Select
                  value={armadorId}
                  onValueChange={setArmadorId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Aleatorio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aleatorio">Aleatorio</SelectItem>
                    {armadores.map((armador) => (
                      <SelectItem key={armador.id} value={armador.id.toString()}>
                        {armador.firstName || armador.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6">
              <Button 
                onClick={handleIngresarPedido}
                disabled={!pedidoText.trim() || createPedidoMutation.isPending}
              >
                {createPedidoMutation.isPending ? "Procesando..." : "Ingresar Pedido"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

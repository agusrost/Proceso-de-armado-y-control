import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useState } from "react";

const transferSchema = z.object({
  codigo: z.string().min(1, "El código es requerido"),
  cantidad: z.string().refine(val => {
    const num = parseInt(val);
    return !isNaN(num) && num > 0;
  }, "La cantidad debe ser un número mayor a 0"),
  motivo: z.string().min(1, "El motivo es requerido"),
  clienteId: z.string().min(1, "El número de cliente es requerido"),
  pedidoId: z.string().min(1, "El ID del pedido es requerido"),
  solicitante: z.string().optional(),
});

type TransferFormValues = z.infer<typeof transferSchema>;

interface TransferenciaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TransferenciaModal({ isOpen, onClose }: TransferenciaModalProps) {
  const { toast } = useToast();
  const [motivoPersonalizado, setMotivoPersonalizado] = useState(false);
  const [showSolicitante, setShowSolicitante] = useState(false);
  
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      codigo: "",
      cantidad: "",
      motivo: "",
      clienteId: "",
      pedidoId: "",
      solicitante: "",
    },
  });
  
  const createSolicitudMutation = useMutation({
    mutationFn: async (data: TransferFormValues) => {
      // Formatear el motivo para incluir el cliente y pedido
      const motivoCompleto = `Faltante en pedido ${data.pedidoId} - Cliente Nro ${data.clienteId}`;
      
      const solicitudData: any = {
        codigo: data.codigo,
        cantidad: parseInt(data.cantidad),
        // Incluir el motivo personalizado o el motivo base con la información del cliente y pedido
        motivo: data.motivo === "Faltante en pedido" ? motivoCompleto : data.motivo,
        clienteId: data.clienteId,
        pedidoId: data.pedidoId,
      };
      
      // Si el motivo es facturación y hay un solicitante, lo incluimos
      if (data.motivo === "Se necesita para facturar un pedido" && data.solicitante) {
        solicitudData.solicitante = data.solicitante;
      }
      
      const res = await apiRequest("POST", "/api/stock", solicitudData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitud creada",
        description: "La solicitud de transferencia ha sido creada correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear solicitud",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: TransferFormValues) => {
    createSolicitudMutation.mutate(data);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Transferencia</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="codigo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código</FormLabel>
                  <FormControl>
                    <Input placeholder="Código del producto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="cantidad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cantidad</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Cantidad requerida" 
                      type="number" 
                      min="1" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="motivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    {motivoPersonalizado ? (
                      <Input 
                        placeholder="Escriba el motivo personalizado" 
                        {...field} 
                        onChange={(e) => {
                          field.onChange(e.target.value);
                        }}
                      />
                    ) : (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          if (value === "otro") {
                            setMotivoPersonalizado(true);
                            setShowSolicitante(false);
                            field.onChange("");
                          } else if (value === "Se necesita para facturar un pedido") {
                            setMotivoPersonalizado(false);
                            setShowSolicitante(true);
                            field.onChange(value);
                          } else if (value === "Faltante en pedido") {
                            setMotivoPersonalizado(false);
                            setShowSolicitante(false);
                            field.onChange(value);
                          } else {
                            setMotivoPersonalizado(false);
                            setShowSolicitante(false);
                            field.onChange(value);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un motivo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Faltante en pedido">Faltante en pedido</SelectItem>
                          <SelectItem value="Se necesita para facturar un pedido">Se necesita para facturar un pedido</SelectItem>
                          <SelectItem value="otro">Otro motivo</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </FormControl>
                  {motivoPersonalizado && (
                    <div className="flex justify-end">
                      <Button 
                        type="button" 
                        variant="link" 
                        className="h-auto p-0 text-xs"
                        onClick={() => {
                          setMotivoPersonalizado(false);
                          field.onChange("");
                        }}
                      >
                        Volver a opciones predefinidas
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {form.watch("motivo") === "Faltante en pedido" && (
              <>
                <FormField
                  control={form.control}
                  name="clienteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Cliente</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: 8795" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pedidoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID del Pedido</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: P8114" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            
            {showSolicitante && (
              <FormField
                control={form.control}
                name="solicitante"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Solicitado por (usuario de Admin. Gral)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nombre del solicitante" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createSolicitudMutation.isPending}
              >
                {createSolicitudMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Solicitando...</>
                ) : (
                  "Solicitar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

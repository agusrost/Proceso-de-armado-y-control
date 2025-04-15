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
});

type TransferFormValues = z.infer<typeof transferSchema>;

interface TransferenciaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TransferenciaModal({ isOpen, onClose }: TransferenciaModalProps) {
  const { toast } = useToast();
  
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      codigo: "",
      cantidad: "",
      motivo: "",
    },
  });
  
  const createSolicitudMutation = useMutation({
    mutationFn: async (data: TransferFormValues) => {
      const solicitudData = {
        codigo: data.codigo,
        cantidad: parseInt(data.cantidad),
        motivo: data.motivo,
      };
      
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
                    <Input placeholder="Motivo de la solicitud" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
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

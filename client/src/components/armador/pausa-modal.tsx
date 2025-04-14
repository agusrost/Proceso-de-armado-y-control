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

const pausaSchema = z.object({
  motivo: z.string().min(1, "El motivo es requerido"),
  otroMotivo: z.string().optional(),
});

type PausaFormValues = z.infer<typeof pausaSchema>;

interface PausaModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedidoId: number;
  onPausaCreated: (pausaId: number) => void;
}

export default function PausaModal({ isOpen, onClose, pedidoId, onPausaCreated }: PausaModalProps) {
  const { toast } = useToast();
  
  const form = useForm<PausaFormValues>({
    resolver: zodResolver(pausaSchema),
    defaultValues: {
      motivo: "",
      otroMotivo: "",
    },
  });
  
  const motivoSeleccionado = form.watch("motivo");
  
  const createPausaMutation = useMutation({
    mutationFn: async (data: PausaFormValues) => {
      const motivoFinal = data.motivo === "otro" ? data.otroMotivo : data.motivo;
      
      const pausaData = {
        pedidoId,
        motivo: motivoFinal,
      };
      
      const res = await apiRequest("POST", "/api/pausas", pausaData);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Pausa iniciada",
        description: "La pausa ha sido iniciada correctamente",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/pedidos/${pedidoId}`] });
      form.reset();
      onClose();
      onPausaCreated(data.id);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al iniciar pausa",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: PausaFormValues) => {
    createPausaMutation.mutate(data);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pausar Armado</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="motivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo de la pausa</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un motivo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="baño">Necesidad de ir al baño</SelectItem>
                      <SelectItem value="descanso">Descanso programado</SelectItem>
                      <SelectItem value="consulta">Consulta con supervisor</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {motivoSeleccionado === "otro" && (
              <FormField
                control={form.control}
                name="otroMotivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especifique el motivo</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                variant="warning" 
                disabled={createPausaMutation.isPending}
              >
                {createPausaMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Pausando...</>
                ) : (
                  "Pausar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";

// Esquema para validación del formulario
const perfilSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Ingrese un email válido").optional(),
  currentPassword: z.string().min(1, "Ingrese su contraseña actual"),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
  // Si se proporciona nueva contraseña, confirmar contraseña debe coincidir
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type PerfilFormValues = z.infer<typeof perfilSchema>;

export default function MiPerfilPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [changePassword, setChangePassword] = useState(false);
  
  const form = useForm<PerfilFormValues>({
    resolver: zodResolver(perfilSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  const updatePerfilMutation = useMutation({
    mutationFn: async (data: PerfilFormValues) => {
      // Solo enviar campos que cambiarán
      const updateData: Record<string, any> = {};
      
      if (data.firstName) updateData.firstName = data.firstName;
      if (data.lastName) updateData.lastName = data.lastName;
      if (data.email) updateData.email = data.email;
      
      // Si hay nueva contraseña, incluirla
      if (data.newPassword) {
        updateData.password = data.newPassword;
      }
      
      // Incluir contraseña actual para verificación
      updateData.currentPassword = data.currentPassword;
      
      const res = await apiRequest("PUT", `/api/users/${user?.id}/perfil`, updateData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Perfil actualizado",
        description: "Tus datos han sido actualizados correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      form.reset({
        ...form.getValues(),
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setChangePassword(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar perfil",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: PerfilFormValues) => {
    updatePerfilMutation.mutate(data);
  };
  
  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Mi Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Tu nombre" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido</FormLabel>
                        <FormControl>
                          <Input placeholder="Tu apellido" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="tu.email@ejemplo.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <Label htmlFor="change-password">Cambiar contraseña</Label>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="change-password-toggle">Mostrar campos</Label>
                      <input
                        type="checkbox"
                        id="change-password-toggle"
                        checked={changePassword}
                        onChange={() => setChangePassword(!changePassword)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña actual</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ingresa tu contraseña actual" 
                            type="password" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {changePassword && (
                    <>
                      <FormField
                        control={form.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nueva contraseña</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Ingresa nueva contraseña" 
                                type="password" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar nueva contraseña</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Confirma nueva contraseña" 
                                type="password" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updatePerfilMutation.isPending}
                  >
                    {updatePerfilMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                    ) : (
                      "Guardar cambios"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
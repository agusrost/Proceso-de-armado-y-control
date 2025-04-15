import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, ExtendedUser, extendedUserSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export default function UserForm({ isOpen, onClose, user }: UserFormProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  // Only Admin Plus users can modify roles and access
  const canModifyRoles = currentUser?.role === 'admin-plus';

  const form = useForm<ExtendedUser>({
    resolver: zodResolver(extendedUserSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      email: "",
      role: "armador",
      access: ["pedidos"],
    },
  });

  // When editing a user, pre-fill the form
  useEffect(() => {
    if (user) {
      form.reset({
        username: user.username,
        password: "", // Don't show existing password
        confirmPassword: "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        role: user.role as any || "armador",
        access: user.access as any || ["pedidos"],
      });
    } else {
      form.reset({
        username: "",
        password: "",
        confirmPassword: "",
        firstName: "",
        lastName: "",
        email: "",
        role: "armador",
        access: ["pedidos"],
      });
    }
  }, [user, form]);

  // For creating/updating users
  const userMutation = useMutation({
    mutationFn: async (userData: Partial<ExtendedUser>) => {
      if (user) {
        // Updating existing user
        const { confirmPassword, ...data } = userData;
        // Only send password if it's not empty
        if (!data.password) {
          delete data.password;
        }
        const res = await apiRequest("PUT", `/api/users/${user.id}`, data);
        return await res.json();
      } else {
        // Creating new user - include confirmPassword field
        const res = await apiRequest("POST", "/api/register", userData);
        return await res.json();
      }
    },
    onSuccess: () => {
      toast({
        title: user ? "Usuario actualizado" : "Usuario creado",
        description: user ? "El usuario ha sido actualizado correctamente" : "El usuario ha sido creado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: user ? "Error al actualizar usuario" : "Error al crear usuario",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExtendedUser) => {
    userMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{user ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
        </DialogHeader>
        
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
                      <Input placeholder="Nombre" {...field} />
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
                      <Input placeholder="Apellido" {...field} />
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
                    <Input placeholder="Email" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuario</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nombre de usuario" 
                      {...field} 
                      disabled={!!user} // Disable username editing for existing users
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{user ? "Nueva Contraseña (dejar en blanco para mantener)" : "Contraseña"}</FormLabel>
                  <FormControl>
                    <Input placeholder="Contraseña" type="password" {...field} />
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
                  <FormLabel>Confirmar Contraseña</FormLabel>
                  <FormControl>
                    <Input placeholder="Confirmar contraseña" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {canModifyRoles && (
              <>
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Rol</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="admin-plus" />
                            </FormControl>
                            <FormLabel className="font-normal">Admin Plus</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="admin-gral" />
                            </FormControl>
                            <FormLabel className="font-normal">Admin Gral</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="stock" />
                            </FormControl>
                            <FormLabel className="font-normal">Stock</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="armador" />
                            </FormControl>
                            <FormLabel className="font-normal">Armador</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="control" />
                            </FormControl>
                            <FormLabel className="font-normal">Control</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="access"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Accesos</FormLabel>
                      </div>
                      <div className="space-y-2">
                        <FormField
                          control={form.control}
                          name="access"
                          render={({ field }) => {
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes('pedidos')}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value || [], 'pedidos'])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== 'pedidos'
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Pedidos
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                        <FormField
                          control={form.control}
                          name="access"
                          render={({ field }) => {
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes('stock')}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value || [], 'stock'])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== 'stock'
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Stock
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                        <FormField
                          control={form.control}
                          name="access"
                          render={({ field }) => {
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes('control')}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value || [], 'control'])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== 'control'
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Control
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                        <FormField
                          control={form.control}
                          name="access"
                          render={({ field }) => {
                            return (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes('config')}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value || [], 'config'])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== 'config'
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Configuración
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
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
                disabled={userMutation.isPending}
              >
                {userMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                ) : (
                  "Guardar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

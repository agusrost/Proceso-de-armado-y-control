import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User, LoginData, InsertUser, ExtendedUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Tipo extendido para User con propiedades del modo de emergencia
interface UserWithEmergencyInfo extends User {
  emergencyMode?: boolean;
  emergencyMessage?: string;
}

type AuthContextType = {
  user: UserWithEmergencyInfo | null;
  isLoading: boolean;
  error: Error | null;
  isEmergencyMode: boolean;
  emergencyMessage: string | null;
  loginMutation: UseMutationResult<UserWithEmergencyInfo, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<UserWithEmergencyInfo, Error, ExtendedUser>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<UserWithEmergencyInfo | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  
  // Comprueba si estamos en modo de emergencia basado en la respuesta del usuario
  const isEmergencyMode = !!user?.emergencyMode;
  const emergencyMessage = user?.emergencyMessage || null;

  // También verificamos el estado del sistema para mostrar alertas
  const systemStatusQuery = useQuery<{ emergencyMode: boolean, dbConnected: boolean, dbConnectionErrors: number }>({
    queryKey: ['/api/system-status'],
    refetchInterval: 30000, // Verificar cada 30 segundos
    retry: 3,
    retryDelay: 1000,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        console.log("Iniciando solicitud de inicio de sesión...");
        
        // Verificar si estamos en modo de emergencia antes de iniciar sesión
        try {
          const statusResponse = await fetch('/api/system-status');
          if (statusResponse.ok) {
            const status = await statusResponse.json();
            if (status.emergencyMode) {
              console.log("Detectado modo de emergencia activo durante inicio de sesión", status);
            }
          }
        } catch (err) {
          console.warn("No se pudo verificar el estado del sistema:", err);
        }
        
        const res = await apiRequest("POST", "/api/login", credentials);
        
        // Verificar el tipo de contenido
        const contentType = res.headers.get("Content-Type");
        console.log("Tipo de contenido recibido:", contentType);
        
        if (!contentType || !contentType.includes("application/json")) {
          console.error("Respuesta no es JSON:", contentType);
          // Intentar obtener el texto de la respuesta para diagnóstico
          const text = await res.text();
          console.error("Contenido de respuesta:", text.substring(0, 150) + "...");
          throw new Error(`Respuesta inesperada del servidor: ${contentType || "desconocido"}`);
        }
        
        // Si llegamos aquí, es que la respuesta es JSON
        const userData = await res.json();
        
        // Verificar si la respuesta contiene información de modo de emergencia
        if (userData.emergencyMode) {
          console.log("Usuario autenticado en modo de emergencia");
        }
        
        return userData;
      } catch (error) {
        console.error("Error en login:", error);
        throw error;
      }
    },
    onSuccess: (user: UserWithEmergencyInfo) => {
      queryClient.setQueryData(["/api/user"], user);
      
      const welcomeMessage = `Bienvenido, ${user.firstName || user.username}`;
      
      // Mostrar una notificación de modo de emergencia si es necesario
      if (user.emergencyMode) {
        toast({
          title: "Inicio de sesión en modo de emergencia",
          description: welcomeMessage + ". Sistema operando con funcionalidades limitadas.",
          variant: "destructive",
          duration: 6000,
        });
      } else {
        toast({
          title: "Inicio de sesión exitoso",
          description: welcomeMessage,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error de inicio de sesión",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: ExtendedUser) => {
      try {
        // Verificar si estamos en modo de emergencia
        const systemStatus = systemStatusQuery.data;
        if (systemStatus?.emergencyMode) {
          console.log("Registro en modo de emergencia");
        }
        
        const { confirmPassword, ...data } = userData;
        const res = await apiRequest("POST", "/api/register", data);
        const registeredUser = await res.json();
        
        // Verificar si la respuesta contiene información de modo de emergencia
        if (registeredUser.emergencyMode) {
          console.log("Usuario registrado en modo de emergencia");
        }
        
        return registeredUser;
      } catch (error) {
        console.error("Error en registro:", error);
        throw error;
      }
    },
    onSuccess: (user: UserWithEmergencyInfo) => {
      queryClient.setQueryData(["/api/user"], user);
      
      const welcomeMessage = `Bienvenido, ${user.firstName || user.username}`;
      
      // Mostrar una notificación de modo de emergencia si es necesario
      if (user.emergencyMode) {
        toast({
          title: "Registro en modo de emergencia",
          description: welcomeMessage + ". Sistema operando con funcionalidades limitadas.",
          variant: "destructive",
          duration: 6000,
        });
      } else {
        toast({
          title: "Registro exitoso",
          description: welcomeMessage,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error de registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        // Check if we're in emergency mode
        const wasInEmergencyMode = isEmergencyMode;
        
        await apiRequest("POST", "/api/logout");
        
        // En modo de emergencia, forzar invalidación del caché
        if (wasInEmergencyMode) {
          queryClient.clear();
          console.log("Caché limpiado después de cerrar sesión en modo de emergencia");
        }
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
        
        // Si estamos en modo de emergencia, eliminar datos de usuario de todas formas
        if (isEmergencyMode) {
          queryClient.setQueryData(["/api/user"], null);
          console.log("Forzando limpieza de datos de usuario en modo de emergencia a pesar del error");
          // No propagar el error en modo de emergencia para asegurar que el usuario pueda cerrar sesión
          return;
        }
        
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
    },
    onError: (error: Error) => {
      // Si ocurre un error que llegue hasta aquí, mostrar mensaje
      toast({
        title: "Error al cerrar sesión",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        isEmergencyMode,
        emergencyMessage,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User, LoginData, InsertUser, ExtendedUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Tipo de usuario simplificado que podemos usar mientras se carga el componente
type BasicUser = {
  id: number;
  username: string;
};

type AuthContextType = {
  user: User | BasicUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, ExtendedUser>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [fallbackUser, setFallbackUser] = useState<BasicUser | null>(null);
  
  // Intento de recuperar el usuario automáticamente
  useEffect(() => {
    // Solo intentamos recuperar el usuario si no tenemos uno ya
    if (!fallbackUser) {
      fetch('/__api/user', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      })
        .then(res => {
          if (res.ok) {
            return res.json();
          }
          if (res.status === 401) {
            // Usuario no autenticado, es esperado
            return null;
          }
          throw new Error(`Error al obtener usuario: ${res.status}`);
        })
        .then(userData => {
          if (userData) {
            console.log('Usuario recuperado manualmente:', userData.username);
            setFallbackUser(userData);
          }
        })
        .catch(err => {
          console.error('Error al recuperar usuario manualmente:', err);
        });
    }
  }, []);

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: 1,
    retryDelay: 1000,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        console.log("Iniciando solicitud de inicio de sesión...");
        const res = await apiRequest("POST", "/api/login", credentials);
        
        // Si llegamos aquí, es que la respuesta es JSON
        const userData = await res.json();
        // Usar el fallback si está disponible
        setFallbackUser(userData);
        return userData;
      } catch (error) {
        console.error("Error en login:", error);
        throw error;
      }
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Inicio de sesión exitoso",
        description: `Bienvenido, ${user.firstName || user.username}`,
      });
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
      const { confirmPassword, ...data } = userData;
      const res = await apiRequest("POST", "/api/register", data);
      const newUser = await res.json();
      // Usar el fallback si está disponible
      setFallbackUser(newUser);
      return newUser;
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Registro exitoso",
        description: `Bienvenido, ${user.firstName || user.username}`,
      });
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
      await apiRequest("POST", "/api/logout");
      // Limpiar el usuario fallback también
      setFallbackUser(null);
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cerrar sesión",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Usar el usuario de la query o el fallback si está disponible
  const activeUser = user || fallbackUser;

  return (
    <AuthContext.Provider
      value={{
        user: activeUser,
        isLoading: isLoading && !fallbackUser,
        error,
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

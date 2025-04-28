import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Intentar parsear la respuesta como JSON primero
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await res.json();
        throw new Error(errorData.message || `${res.status}: ${res.statusText}`);
      } else {
        // Si no es JSON, obtener el texto
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
    } catch (error) {
      // Si hay un error al analizar la respuesta, lanzar un error genérico
      if (error instanceof SyntaxError) {
        throw new Error(`${res.status}: Error de formato en la respuesta`);
      }
      throw error;
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    console.log(`Ejecutando ${method} a ${url}`);
    
    const res = await fetch(url, {
      method,
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        "Accept": "application/json" // Siempre solicitar JSON
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    // Verificar el tipo de contenido
    const contentType = res.headers.get("Content-Type");
    console.log(`Respuesta recibida de ${url}: ${res.status} ${res.statusText}, Content-Type: ${contentType}`);
    
    if (!res.ok) {
      if (!contentType || !contentType.includes("application/json")) {
        console.error(`Respuesta no-JSON en error de ${url}:`, contentType);
        // Intentar obtener el texto de la respuesta para diagnóstico
        const text = await res.text();
        const excerpt = text.length > 150 ? text.substring(0, 147) + '...' : text;
        console.error(`Contenido no-JSON: ${excerpt}`);
        throw new Error(`Error del servidor: respuesta no es JSON`);
      }
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`Error en solicitud API (${method} ${url}):`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      console.log(`Haciendo petición a: ${queryKey[0]}`);
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
        // Forzar que acepte JSON
        headers: {
          'Accept': 'application/json'
        }
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      // Verificar tipo de contenido antes de procesar
      const contentType = res.headers.get('content-type');
      console.log(`Tipo de contenido recibido: ${contentType}`);
      
      if (!contentType || !contentType.includes('application/json')) {
        console.error(`Respuesta no JSON recibida para ${queryKey[0]}:`, contentType);
        // Obtener el texto de la respuesta para diagnóstico
        const text = await res.text();
        const excerpt = text.length > 150 ? text.substring(0, 147) + '...' : text;
        console.error(`Contenido no-JSON: ${excerpt}`);
        throw new Error(`Respuesta inesperada del servidor: no es JSON`);
      }
      
      await throwIfResNotOk(res);
      
      // Parseamos el JSON
      const data = await res.json();
      console.log(`Datos recibidos de ${queryKey[0]}:`, data ? 'OK' : 'NULL');
      return data;
    } catch (error) {
      console.error(`Error en consulta API (${queryKey[0]}):`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

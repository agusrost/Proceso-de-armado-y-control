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
    // Modificar la URL para evitar que Vite la intercepte
    let apiUrl = url;
    
    // Asegurarse de que no exista duplicación de prefijos
    if (url.startsWith('/api/')) {
      // Usar /__api sin duplicar el /api/ en el camino
      const path = url.substring(5); // Eliminar '/api/' inicial
      apiUrl = `/__api/${path}`;
      console.log(`Corrigiendo ruta API: ${method} ${url} → ${apiUrl}`);
    } else if (!url.startsWith('http')) {
      // Si es una ruta relativa pero no comienza con /api/
      apiUrl = `/__api${url.startsWith('/') ? url : '/' + url}`;
      console.log(`Ajustando ruta API: ${method} ${url} → ${apiUrl}`);
    } else {
      console.log(`Ejecutando petición a URL externa: ${method} ${apiUrl}`);
    }
    
    const res = await fetch(apiUrl, {
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
      // Modificar la URL para evitar que Vite la intercepte
      let url = queryKey[0] as string;
      
      // Asegurarse de que no exista duplicación de prefijos
      if (url.startsWith('/api/')) {
        // Usar /__api sin duplicar el /api/ en el camino
        const path = url.substring(5); // Eliminar '/api/' inicial
        url = `/__api/${path}`;
        console.log(`Corrigiendo ruta API para queryKey: ${url}`);
      } else if (!url.startsWith('http')) {
        // Si es una ruta relativa pero no comienza con /api/
        url = `/__api${url.startsWith('/') ? url : '/' + url}`;
        console.log(`Ajustando ruta API para queryKey: ${url}`);
      } else {
        console.log(`Haciendo petición a URL externa: ${url}`);
      }
      
      const res = await fetch(url, {
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

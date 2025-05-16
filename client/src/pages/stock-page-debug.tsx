import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";

export default function StockPageDebug() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      console.log("Usuario actual en StockPageDebug:", user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      console.error("Error en StockPageDebug:", err);
    }
  }, [user]);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <h2 className="text-xl font-semibold mb-4">Página de Diagnóstico de Stock</h2>
        
        <Card>
          <CardContent className="pt-6">
            <p>Esta es una página de diagnóstico para la sección de Stock.</p>
            
            {error ? (
              <div className="mt-4 p-4 bg-red-100 text-red-800 rounded-md">
                <p className="font-semibold">Error detectado:</p>
                <p>{error}</p>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-green-100 text-green-800 rounded-md">
                <p>No se detectaron errores en la carga de la página.</p>
              </div>
            )}
            
            <div className="mt-4 p-4 bg-blue-100 text-blue-800 rounded-md">
              <p className="font-semibold">Información del usuario:</p>
              <pre className="whitespace-pre-wrap mt-2">
                {user ? JSON.stringify(user, null, 2) : "No hay usuario autenticado"}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
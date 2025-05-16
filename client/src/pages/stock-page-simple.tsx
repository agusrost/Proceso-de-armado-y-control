import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function StockPageSimple() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Gestión de Stock</h2>
          <Button 
            className="flex items-center gap-2"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Transferencia</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Solicitudes de Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Versión simplificada de la página de stock.</p>
            <p className="mt-2">Usuario actual: {user?.username || "No autenticado"}</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
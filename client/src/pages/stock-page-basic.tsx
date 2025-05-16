import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function StockPageBasic() {
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Gestión de Stock (Versión Básica)</h2>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>Nueva Transferencia</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Solicitudes de Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Esta es una versión básica de la página de stock para diagnosticar problemas.</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
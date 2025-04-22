import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DownloadCloud, UploadCloud, FileWarning } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";

export default function ImportarExportarPage() {
  const { toast } = useToast();
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Exportar datos
  const exportarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/database/export");
      return await res.json();
    },
    onSuccess: (data) => {
      // Crear un blob y descargarlo
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      const fecha = new Date().toISOString().split("T")[0];
      link.download = `konecta_repuestos_datos_${fecha}.json`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      
      URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      toast({
        title: "Exportación completada",
        description: "Los datos han sido exportados correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al exportar datos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Importar datos
  const importarMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/database/import", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Importación completada",
        description: `Se han importado: ${data.resultados.pedidos} pedidos, ${data.resultados.productos} productos, ${data.resultados.stockSolicitudes} solicitudes de stock`,
      });
      setFileToImport(null);
      setImportData(null);
      setShowConfirmDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al importar datos",
        description: error.message,
        variant: "destructive",
      });
      setShowConfirmDialog(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setFileToImport(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonData = JSON.parse(event.target?.result as string);
          setImportData(jsonData);
        } catch (error) {
          toast({
            title: "Error al leer archivo",
            description: "El archivo no contiene un formato JSON válido",
            variant: "destructive",
          });
          setFileToImport(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImport = () => {
    if (importData) {
      importarMutation.mutate(importData);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Importar / Exportar Datos</h1>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Gestión de Datos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-600 mb-4">
              Esta sección permite importar o exportar datos de la aplicación. Útil para realizar copias de seguridad
              o migrar datos entre diferentes instancias del sistema.
            </p>

            <Tabs defaultValue="exportar">
              <TabsList className="mb-4">
                <TabsTrigger value="exportar">Exportar Datos</TabsTrigger>
                <TabsTrigger value="importar">Importar Datos</TabsTrigger>
              </TabsList>
              
              <TabsContent value="exportar" className="space-y-4">
                <div className="bg-neutral-50 p-4 rounded-md border border-neutral-200">
                  <h3 className="font-medium mb-2">Exportar todos los datos</h3>
                  <p className="text-sm text-neutral-600 mb-4">
                    Descarga un archivo JSON con todos los datos actuales del sistema: pedidos, productos, stock, etc.
                  </p>
                  <Button
                    onClick={() => exportarMutation.mutate()}
                    disabled={exportarMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <DownloadCloud className="h-4 w-4" />
                    {exportarMutation.isPending ? "Exportando..." : "Exportar Datos"}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="importar" className="space-y-4">
                <div className="bg-neutral-50 p-4 rounded-md border border-neutral-200">
                  <h3 className="font-medium mb-2">Importar datos</h3>
                  <p className="text-sm text-neutral-600 mb-4">
                    Sube un archivo JSON con datos para importar al sistema.
                  </p>
                  
                  <div className="mb-4">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-neutral-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-medium
                        file:bg-neutral-100 file:text-neutral-700
                        hover:file:bg-neutral-200
                      "
                    />
                  </div>
                  
                  {fileToImport && (
                    <div className="mb-4 p-3 bg-neutral-100 rounded-md">
                      <p className="text-sm font-medium">Archivo seleccionado: {fileToImport.name}</p>
                    </div>
                  )}
                  
                  <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                    <AlertDialogTrigger asChild>
                      <Button
                        disabled={!fileToImport || importarMutation.isPending}
                        className="flex items-center gap-2"
                        variant="default"
                      >
                        <UploadCloud className="h-4 w-4" />
                        {importarMutation.isPending ? "Importando..." : "Importar Datos"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar importación</AlertDialogTitle>
                        <AlertDialogDescription>
                          <div className="flex items-start gap-2 mb-3 text-amber-600">
                            <FileWarning className="h-5 w-5 mt-0.5" />
                            <span>
                              ¡Atención! La importación podría sobrescribir datos existentes. 
                              Asegúrate de tener una copia de seguridad antes de continuar.
                            </span>
                          </div>
                          <p>Esta acción importará nuevos datos al sistema.</p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleImport}>
                          Confirmar Importación
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
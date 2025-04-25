import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Table, 
  Link as LinkIcon, 
  RefreshCcw, 
  Cog, 
  AlertCircle,
  CheckCircle2,
  Save,
  RefreshCw
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ControlNav } from "@/components/control/control-nav";
import { Configuracion } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";

export default function ControlConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Estado para la URL de Google Sheets
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<string | null>(null);
  
  // Estado para opciones de control automático
  const [autoFinishEnabled, setAutoFinishEnabled] = useState(true);
  
  // Cargar configuración actual
  const { 
    data: configuraciones = [], 
    isLoading 
  } = useQuery<Configuracion[]>({
    queryKey: ["/api/configuracion"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/configuracion");
      if (!res.ok) throw new Error("Error al cargar configuración");
      return res.json();
    },
  });
  
  // Inicializar estados con configuraciones cargadas
  useEffect(() => {
    if (configuraciones.length > 0) {
      // Buscar la URL de Google Sheets
      const sheetsConfig = configuraciones.find(c => c.clave === "google_sheets_url");
      if (sheetsConfig) {
        setGoogleSheetsUrl(sheetsConfig.valor);
      }
      
      // Buscar configuración de finalización automática
      const autoFinishConfig = configuraciones.find(c => c.clave === "control_auto_finish");
      if (autoFinishConfig) {
        setAutoFinishEnabled(autoFinishConfig.valor === "true");
      }
    }
  }, [configuraciones]);
  
  // Mutation para guardar configuración
  const guardarConfiguracionMutation = useMutation({
    mutationFn: async (data: { clave: string, valor: string }) => {
      const res = await apiRequest("POST", "/api/configuracion", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al guardar configuración");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configuracion"] });
      toast({
        title: "Configuración guardada",
        description: "Los cambios han sido guardados correctamente"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al guardar configuración",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Mutation para probar la conexión con Google Sheets
  const testGoogleSheetsMutation = useMutation({
    mutationFn: async () => {
      // Verificar si la URL está vacía
      if (!googleSheetsUrl || googleSheetsUrl.trim() === '') {
        throw new Error("Por favor ingrese una URL de Google Sheets");
      }
      
      try {
        const res = await apiRequest("POST", "/api/control/test-google-sheets", { 
          url: googleSheetsUrl 
        });
        
        // Procesar la respuesta como JSON
        const data = await res.json();
        
        // Si la respuesta no fue exitosa, lanzar un error
        if (!res.ok || data.success === false) {
          throw new Error(data.message || "Error al probar conexión");
        }
        
        return data;
      } catch (err: any) {
        // Capturar errores de parsing JSON
        if (err.name === 'SyntaxError') {
          throw new Error("Error al procesar la respuesta del servidor");
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      setTestStatus("success");
      setTestResult(`URL válida. ID del documento: ${data.sheetId}. ${data.instrucciones || ""}`);
    },
    onError: (error: Error) => {
      setTestStatus("error");
      setTestResult(error.message);
    }
  });
  
  // Guardar URL de Google Sheets
  const handleSaveGoogleSheets = () => {
    guardarConfiguracionMutation.mutate({
      clave: "google_sheets_url",
      valor: googleSheetsUrl
    });
  };
  
  // Probar conexión con Google Sheets
  const handleTestGoogleSheets = () => {
    setTestStatus("testing");
    setTestResult(null);
    testGoogleSheetsMutation.mutate();
  };
  
  // Cambiar configuración de finalización automática
  const handleAutoFinishChange = (checked: boolean) => {
    setAutoFinishEnabled(checked);
    guardarConfiguracionMutation.mutate({
      clave: "control_auto_finish",
      valor: checked.toString()
    });
  };
  
  // Determinar si el usuario tiene permisos para editar
  const canEdit = user && ["admin-plus", "admin-gral"].includes(user.role);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Configuración de Control</h1>
        </div>
        
        <ControlNav />
        
        {/* Google Sheets Integration */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <LinkIcon className="h-5 w-5 mr-2 text-primary" />
              Integración con Google Sheets
            </CardTitle>
            <CardDescription>
              Configura la conexión con Google Sheets para obtener información de productos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="google-sheets-url">URL de Google Sheets</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="google-sheets-url"
                    value={googleSheetsUrl}
                    onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1"
                    disabled={!canEdit || guardarConfiguracionMutation.isPending}
                  />
                  <Button 
                    variant="outline"
                    onClick={handleTestGoogleSheets}
                    disabled={!googleSheetsUrl || testGoogleSheetsMutation.isPending}
                  >
                    {testGoogleSheetsMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCcw className="h-4 w-4 mr-2" />
                    )}
                    Probar
                  </Button>
                  <Button 
                    onClick={handleSaveGoogleSheets}
                    disabled={!canEdit || !googleSheetsUrl || guardarConfiguracionMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                  </Button>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Esta URL debe ser de una hoja de Google Sheets publicada para la web y contener los códigos de productos, 
                  descripciones e imágenes.
                </p>
              </div>
              
              {testStatus === "success" && testResult && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle>Conexión exitosa</AlertTitle>
                  <AlertDescription>{testResult}</AlertDescription>
                </Alert>
              )}
              
              {testStatus === "error" && testResult && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertTitle>Error de conexión</AlertTitle>
                  <AlertDescription>{testResult}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Opciones de Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Cog className="h-5 w-5 mr-2 text-primary" />
              Opciones de Control
            </CardTitle>
            <CardDescription>
              Configura las opciones para el proceso de control de pedidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Finalización automática</h3>
                  <p className="text-sm text-neutral-500">
                    Finaliza automáticamente el control cuando todos los productos han sido escaneados correctamente
                  </p>
                </div>
                <Switch 
                  checked={autoFinishEnabled} 
                  onCheckedChange={handleAutoFinishChange}
                  disabled={!canEdit || guardarConfiguracionMutation.isPending}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Verificación de ubicaciones</h3>
                  <p className="text-sm text-neutral-500">
                    Verifica que los productos estén en sus ubicaciones correctas durante el control
                  </p>
                </div>
                <Switch 
                  checked={false} 
                  disabled={true}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Control de tiempo</h3>
                  <p className="text-sm text-neutral-500">
                    Activa el control de tiempo para medir la duración del proceso
                  </p>
                </div>
                <Switch 
                  checked={true} 
                  disabled={true}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
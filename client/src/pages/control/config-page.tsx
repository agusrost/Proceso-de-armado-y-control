import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { GoogleSheetsConfig } from "@shared/types";

export default function ControlConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estado para la configuración de Google Sheets
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState("");
  const [googleSheetsDescription, setGoogleSheetsDescription] = useState("");
  
  // Cargar la configuración actual
  const { data: sheetsConfig, isLoading: isLoadingSheetsConfig } = useQuery<GoogleSheetsConfig>({
    queryKey: ["/api/control/config/sheets"],
    onSuccess: (data) => {
      setGoogleSheetsUrl(data.url || "");
      setGoogleSheetsDescription(data.descripcion || "");
    }
  });
  
  // Mutation para guardar la configuración
  const saveSheetsConfigMutation = useMutation({
    mutationFn: async (data: { url: string, descripcion: string }) => {
      const res = await apiRequest("POST", "/api/control/config/sheets", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al guardar la configuración");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuración guardada",
        description: "La configuración de Google Sheets ha sido guardada correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/control/config/sheets"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al guardar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleSaveSheetsConfig = () => {
    saveSheetsConfigMutation.mutate({
      url: googleSheetsUrl,
      descripcion: googleSheetsDescription,
    });
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <Button variant="outline" size="icon" asChild className="mr-4">
            <Link to="/control">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Configuración del Control</h1>
        </div>
        
        <Tabs defaultValue="google-sheets">
          <TabsList className="mb-6">
            <TabsTrigger value="google-sheets">Google Sheets</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>
          
          <TabsContent value="google-sheets">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Google Sheets</CardTitle>
                <CardDescription>
                  Configura la URL de Google Sheets para obtener información sobre los productos durante el control
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="sheets-url">URL de Google Sheets</Label>
                    <Input
                      id="sheets-url"
                      value={googleSheetsUrl}
                      onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                    />
                    <p className="text-sm text-neutral-500 mt-1">
                      URL del documento de Google Sheets con información de productos
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="sheets-description">Descripción</Label>
                    <Textarea
                      id="sheets-description"
                      value={googleSheetsDescription}
                      onChange={(e) => setGoogleSheetsDescription(e.target.value)}
                      placeholder="Descripción de la configuración..."
                      rows={3}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleSaveSheetsConfig}
                    disabled={saveSheetsConfigMutation.isPending || !googleSheetsUrl}
                  >
                    {saveSheetsConfigMutation.isPending ? (
                      "Guardando..."
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar Configuración
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Configuración General</CardTitle>
                <CardDescription>
                  Configuraciones generales del módulo de control
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-500 italic">
                  No hay configuraciones generales disponibles en este momento.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
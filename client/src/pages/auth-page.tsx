import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoginForm from "@/components/forms/login-form";
import RegisterForm from "@/components/forms/register-form";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import konectaLogo from "@/assets/konecta-logo.jpg";
import { SystemStatusIndicator } from "@/components/ui/system-status-indicator";

export default function AuthPage() {
  const { user, isLoading } = useAuth();

  // If user is already logged in, redirect to home
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-100">
      <div className="w-full max-w-4xl mx-auto mb-4">
        <SystemStatusIndicator />
      </div>
      <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row shadow-md">
        {/* Hero section */}
        <div className="bg-primary p-8 text-white flex flex-col justify-center md:w-1/2 rounded-l-lg">
          <div className="flex items-center justify-center mb-6">
            <img src={konectaLogo} alt="Konecta Repuestos" className="h-20" />
          </div>
          <h1 className="text-3xl font-semibold mb-4">Sistema de Gestión de Pedidos</h1>
          <p className="text-white/90 mb-6">
            Plataforma integral para la gestión de pedidos, seguimiento de armado y control de stock.
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>Gestión de pedidos y seguimiento en tiempo real</span>
            </li>
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>Control de stock y solicitudes de transferencia</span>
            </li>
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>Distintos roles y permisos configurables</span>
            </li>
          </ul>
        </div>

        {/* Auth forms */}
        <div className="bg-white p-8 md:w-1/2 rounded-r-lg">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="register">Crear Cuenta</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <Card className="border-0 shadow-none">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Iniciar Sesión</CardTitle>
                  <CardDescription>
                    Ingresa tus credenciales para acceder al sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <LoginForm />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="register">
              <Card className="border-0 shadow-none">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Crear Cuenta</CardTitle>
                  <CardDescription>
                    Completa el formulario para crear una nueva cuenta
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <RegisterForm />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

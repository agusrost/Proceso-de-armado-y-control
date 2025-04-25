import { AuthProvider } from "@/hooks/use-auth";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import { ProtectedRoute } from "./lib/protected-route";
import PedidosCargaPage from "@/pages/pedidos/carga-page";
import PedidosEstadoPage from "@/pages/pedidos/estado-page";
import StockPage from "@/pages/stock-page";
import ConfigPage from "@/pages/config-page";
import ArmadoPage from "@/pages/armado-page-nuevo";
import ControlPage from "@/pages/control-page";
import ControlIndexPage from "@/pages/control/index-page";
import ControlConfigPage from "@/pages/control/config-page";
import ControlHistorialPage from "@/pages/control/historial-page";
import ControlHistorialDetallePage from "@/pages/control/historial-detalle-page";
import ControlPedidoPage from "@/pages/control/pedido-page";
import ControlEstadisticasPage from "@/pages/control/estadisticas-page";
import MiPerfilPage from "@/pages/mi-perfil-page";
import ImportarExportarPage from "@/pages/importar-exportar-page";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/pedidos/carga" component={PedidosCargaPage} />
      <ProtectedRoute path="/pedidos/estado" component={PedidosEstadoPage} />
      <ProtectedRoute path="/stock" component={StockPage} />
      <ProtectedRoute path="/config" component={ConfigPage} />
      <ProtectedRoute path="/armador" component={ArmadoPage} />
      
      {/* Control module routes */}
      <ProtectedRoute path="/control" component={ControlIndexPage} />
      <ProtectedRoute path="/control/config" component={ControlConfigPage} />
      <ProtectedRoute path="/control/historial" component={ControlHistorialPage} />
      <ProtectedRoute path="/control/historial/:id" component={ControlHistorialDetallePage} />
      <ProtectedRoute path="/control/pedido/:id" component={ControlPedidoPage} />
      <ProtectedRoute path="/control/estadisticas" component={ControlEstadisticasPage} />
      
      <ProtectedRoute path="/mi-perfil" component={MiPerfilPage} />
      <ProtectedRoute path="/importar-exportar" component={ImportarExportarPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

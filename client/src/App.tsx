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
// import StockPage from "@/pages/stock-page";
// import StockPageSimple from "@/pages/stock-page-simple";
import StockPageBasic from "@/pages/stock-page-basic";
import ConfigPage from "@/pages/config-page";
import ArmadoPage from "@/pages/armado-page";
import ArmadorPage from "@/pages/armador-page";
import ArmadoSimplePage from "@/pages/armado-simple-page";
import ControlPage from "@/pages/control-page";
import ControlIndexPage from "@/pages/control/index-page";
import ControlConfigPage from "@/pages/control/config-page";
import ControlHistorialPage from "@/pages/control/historial-page";
import ControlHistorialDetallePage from "@/pages/control/historial-detalle-page";
import ControlPedidoPage from "@/pages/control/pedido-page-nuevo";
import ControlPedidoColumnasPage from "@/pages/control/pedido-page-columnas";
import ControlPedidoResetPage from "@/pages/control/pedido-page-reset";
import ControlPedidoSimplePage from "@/pages/control/pedido-page-simple";
import ControlEstadisticasPage from "@/pages/control/estadisticas-page";
import MiPerfilPage from "@/pages/mi-perfil-page";
import ImportarExportarPage from "@/pages/importar-exportar-page";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/pedidos/carga" component={PedidosCargaPage} />
      <ProtectedRoute path="/pedidos/estado" component={PedidosEstadoPage} />
      <Route path="/stock" component={StockPageBasic} />
      <ProtectedRoute path="/config" component={ConfigPage} />
      <ProtectedRoute path="/armado" component={ArmadoSimplePage} />
      <ProtectedRoute path="/armado-simple" component={ArmadoSimplePage} />
      <ProtectedRoute path="/armado-simple/:id" component={ArmadoSimplePage} />
      <ProtectedRoute path="/armado-antiguo" component={ArmadoPage} />
      <ProtectedRoute path="/armador" component={ArmadorPage} />
      
      {/* Control module routes */}
      <ProtectedRoute path="/control" component={ControlIndexPage} />
      <ProtectedRoute path="/control/config" component={ControlConfigPage} />
      <ProtectedRoute path="/control/historial" component={ControlHistorialPage} />
      <ProtectedRoute path="/control/historial/:id" component={ControlHistorialDetallePage} />
      <ProtectedRoute path="/control/pedido/:id" component={ControlPedidoSimplePage} />
      <ProtectedRoute path="/control/pedido-antiguo/:id" component={ControlPedidoPage} />
      <ProtectedRoute path="/control/pedido-columnas/:id" component={ControlPedidoColumnasPage} />
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

import { Toaster } from "@/components/ui/toaster";
import { Route, Switch } from "wouter";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";

// Pages
import HomePage from "@/pages/home-page";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import ArmadoSimplePage from "@/pages/armado-simple-page";
import ControlPage from "@/pages/control-page";
import ArmadorPage from "@/pages/armador-page";
import ArmadoPage from "@/pages/armado-page";
import ConfigPage from "@/pages/config-page";
import StockPage from "@/pages/stock-page";
// Las páginas exportan un default sin nombre, así que importamos directamente
import ControlIndexPage from "@/pages/control/index-page";
import ControlHistorialPage from "@/pages/control/historial-page";
import ControlEstadisticasPage from "@/pages/control/estadisticas-page";
import ControlPedidoPage from "@/pages/control/pedido-page";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/armado-simple/:id" component={ArmadoSimplePage} />
      <ProtectedRoute path="/armado/:id" component={ArmadoPage} />
      <ProtectedRoute path="/armador" component={ArmadorPage} />
      
      {/* Control section */}
      <ProtectedRoute path="/control" component={ControlPage} requiredAccess="control" />
      <ProtectedRoute path="/control/index" component={ControlIndexPage} requiredAccess="control" />
      <ProtectedRoute path="/control/historial" component={ControlHistorialPage} requiredAccess="control" />
      <ProtectedRoute path="/control/estadisticas" component={ControlEstadisticasPage} requiredAccess="control" />
      <ProtectedRoute path="/control/pedido/:id" component={ControlPedidoPage} requiredAccess="control" />
      
      {/* Stock section */}
      <ProtectedRoute path="/stock" component={StockPage} requiredAccess="stock" />
      
      {/* Config section */}
      <ProtectedRoute path="/config" component={ConfigPage} requiredAccess="config" />
      
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

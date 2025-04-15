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
import ArmadoPage from "@/pages/armado-page";
import ControlPage from "@/pages/control-page";
import MiPerfilPage from "@/pages/mi-perfil-page";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/pedidos/carga" component={PedidosCargaPage} />
      <ProtectedRoute path="/pedidos/estado" component={PedidosEstadoPage} />
      <ProtectedRoute path="/stock" component={StockPage} />
      <ProtectedRoute path="/config" component={ConfigPage} />
      <ProtectedRoute path="/armador" component={ArmadoPage} />
      <ProtectedRoute path="/control" component={ControlPage} />
      <ProtectedRoute path="/mi-perfil" component={MiPerfilPage} />
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

// Importación mínima para garantizar que se muestre algo
import { Toaster } from "@/components/ui/toaster";
import MinimalPage from "@/pages/minimal-page";

// Simplificamos completamente el App para resolver el problema crítico
function App() {
  return (
    <div>
      <MinimalPage />
      <Toaster />
    </div>
  );
}

export default App;

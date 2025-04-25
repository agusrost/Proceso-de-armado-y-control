import { useAuth } from "@/hooks/use-auth";

export function KonectaHeader() {
  const { user } = useAuth();
  
  return (
    <header className="bg-slate-900 text-white">
      <div className="container flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="text-lg font-semibold tracking-tight">Konecta Repuestos</div>
          <div className="text-xs text-slate-400">Sistema de Gestión</div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">{user?.username}</div>
          {user?.role === 'armador' && <span className="text-xs text-slate-400">(Armador)</span>}
        </div>
      </div>
    </header>
  );
}
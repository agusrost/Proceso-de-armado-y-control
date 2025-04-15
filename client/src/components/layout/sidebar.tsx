import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  ClipboardList, 
  Package, 
  CheckSquare, 
  Settings,
  LayoutDashboard,
  UserCircle
} from "lucide-react";
import konectaLogo from "@/assets/konecta-logo.svg";

export function Sidebar() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  const hasAccess = (module: string) => {
    return user?.access && Array.isArray(user.access) && user.access.includes(module as any);
  };

  const navItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      href: "/",
      active: location === "/",
      show: true,
    },
    {
      title: "PEDIDOS",
      icon: ClipboardList,
      href: "/pedidos/carga",
      active: location.includes("/pedidos"),
      show: hasAccess("pedidos"),
    },
    {
      title: "STOCK",
      icon: Package,
      href: "/stock",
      active: location === "/stock",
      show: hasAccess("stock"),
    },
    {
      title: "CONTROL",
      icon: CheckSquare,
      href: "/control",
      active: location === "/control",
      show: hasAccess("control"),
    },
    {
      title: "CONFIGURACIÓN",
      icon: Settings,
      href: "/config",
      active: location === "/config",
      show: hasAccess("config"),
    },
    {
      title: "Mi Perfil",
      icon: UserCircle,
      href: "/mi-perfil",
      active: location === "/mi-perfil",
      show: true,
    }
  ];

  return (
    <aside className="w-56 bg-neutral-800 text-white">
      <div className="p-4 flex justify-center border-b border-neutral-700 mb-2">
        <img 
          src={konectaLogo} 
          alt="Konecta Repuestos" 
          className="h-16" 
          onClick={() => setLocation("/")}
          style={{ cursor: 'pointer' }}
        />
      </div>
      <nav className="p-4">
        <ul className="space-y-1">
          {navItems.filter(item => item.show).map((item) => (
            <li key={item.href}>
              <button
                className={cn(
                  "w-full text-left px-4 py-2 rounded-md flex items-center space-x-3 hover:bg-neutral-700",
                  item.active && "bg-primary hover:bg-primary/90"
                )}
                onClick={() => setLocation(item.href)}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

import { LayoutGrid, Menu, ReceiptText, Settings, Users, WalletCards, X } from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ShellNavItem = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
};

const navItems: ShellNavItem[] = [
  { to: "/facturar", label: "Facturar", icon: ReceiptText },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/historial", label: "Historial", icon: LayoutGrid },
  { to: "/gastos", label: "Gastos", icon: WalletCards },
  { to: "/configuracion", label: "Miembros / Emisor", icon: Settings },
];

type SidebarContentProps = {
  collapsed: boolean;
  onNavigate?: () => void;
};

function SidebarContent({ collapsed, onNavigate }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className={cn("rounded-lg border bg-card px-3 py-3", collapsed ? "text-center" : "")}>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Facturación</p>
        {!collapsed ? <p className="mt-1 text-sm font-semibold">App React</p> : null}
      </div>

      <nav className="grid gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              end={item.exact}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-foreground",
                  collapsed ? "justify-center px-2" : "",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const shellTitle = useMemo(() => {
    return navItems.find((item) => location.pathname.startsWith(item.to))?.label || "Facturación";
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="grid">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Facturación React</span>
          <span className="text-sm font-semibold">{shellTitle}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
          <Menu className="h-4 w-4" />
        </Button>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            className="h-full w-72 bg-background shadow-xl"
            onClick={(event) => event.stopPropagation()}
            aria-label="Menú principal"
          >
            <div className="flex items-center justify-between border-b px-3 py-3">
              <span className="text-sm font-semibold">Menú</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className={cn(
            "hidden shrink-0 border-r bg-background lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col",
            collapsed ? "lg:w-[76px]" : "lg:w-[260px]",
          )}
          aria-label="Menú principal"
        >
          <div className="flex items-center justify-end border-b p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expandir menú" : "Compactar menú"}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
          <SidebarContent collapsed={collapsed} />
        </aside>

        <main className="min-h-[calc(100vh-57px)] w-full min-w-0 flex-1 lg:min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

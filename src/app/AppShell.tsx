import { useQueryClient } from "@tanstack/react-query";
import { BarChart2, LayoutGrid, LogOut, Menu, Moon, ReceiptText, Settings, Sun, Users, WalletCards, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthContext";
import { getAuthToken } from "@/infrastructure/api/httpClient";
import { cn } from "@/lib/utils";

type ShellNavItem = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
};

const navItems: ShellNavItem[] = [
  { to: "/facturar", label: "Facturar", icon: ReceiptText },
  { to: "/historial", label: "Historial", icon: LayoutGrid },
  { to: "/gastos", label: "Gastos", icon: WalletCards },
  { to: "/datos", label: "Datos", icon: BarChart2 },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/configuracion", label: "Miembros / Emisor", icon: Settings },
];

const FACTURACION_STORAGE_SCOPE_EVENT = "facturacion-storage-scope-changed";

type SidebarContentProps = {
  collapsed: boolean;
  isDark: boolean;
  toggle: () => void;
  sandbox: boolean;
  toggleSandbox: () => void;
  onNavigate?: () => void;
  onLogout?: () => void;
};

function SidebarContent({ collapsed, isDark, toggle, sandbox, toggleSandbox, onNavigate, onLogout }: SidebarContentProps) {
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

      <div className="mt-auto border-t pt-2">
        <Button
          type="button"
          variant={sandbox ? "default" : "ghost"}
          size="sm"
          className={cn(
            "w-full justify-start gap-2",
            sandbox ? "" : "text-muted-foreground",
            collapsed ? "justify-center px-2" : "",
          )}
          onClick={toggleSandbox}
          title="Modo prueba (sandbox)"
        >
          {collapsed ? "S" : sandbox ? "Prueba ON" : "Prueba OFF"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={cn("w-full justify-start gap-2 text-muted-foreground", collapsed ? "justify-center px-2" : "")}
          onClick={toggle}
          aria-label={isDark ? "Modo claro" : "Modo oscuro"}
        >
          {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!collapsed ? <span>{isDark ? "Modo claro" : "Modo oscuro"}</span> : null}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={cn("w-full justify-start gap-2 text-muted-foreground", collapsed ? "justify-center px-2" : "")}
          onClick={() => {
            onLogout?.();
            onNavigate?.();
          }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed ? <span>Cerrar sesión</span> : null}
        </Button>
      </div>
    </div>
  );
}

function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("facturacion-ui-theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("facturacion-ui-theme", isDark ? "dark" : "light");
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((v) => !v) };
}

function useSandbox() {
  const [sandbox, setSandbox] = useState(() => localStorage.getItem("facturacion-storage-scope") === "sandbox");
  useEffect(() => {
    localStorage.setItem("facturacion-storage-scope", sandbox ? "sandbox" : "production");
    window.dispatchEvent(new Event(FACTURACION_STORAGE_SCOPE_EVENT));
  }, [sandbox]);
  return { sandbox, toggleSandbox: () => setSandbox((v) => !v) };
}

export function AppShell() {
  const { logout, authVersion } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isDark, toggle } = useTheme();
  const { sandbox, toggleSandbox } = useSandbox();
  const wizardDialogRef = useRef<HTMLDialogElement>(null);
  const [wizardVisible, setWizardVisible] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const shellTitle = useMemo(() => {
    return navItems.find((item) => location.pathname.startsWith(item.to))?.label || "Facturación";
  }, [location.pathname]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const gmail = params.get("gmail");
    if (!gmail) {
      return;
    }
    params.delete("gmail");
    const rest = params.toString();
    void (async () => {
      await queryClient.invalidateQueries({ queryKey: ["gmail-status"] });
      await queryClient.invalidateQueries({ queryKey: ["gmail-status-batch"] });
      await queryClient.invalidateQueries({ queryKey: ["gmail-profiles"] });
      navigate({ pathname: location.pathname, search: rest ? `?${rest}` : "" }, { replace: true });
    })();
  }, [location.pathname, location.search, navigate, queryClient]);

  useEffect(() => {
    try {
      if (typeof localStorage === "undefined" || typeof localStorage.getItem !== "function") {
        return;
      }
      if (localStorage.getItem("facturacion-wizard-seen") === "1") {
        return;
      }
    } catch {
      return;
    }
    if (!getAuthToken()) {
      return;
    }
    setWizardVisible(true);
  }, [authVersion]);

  useEffect(() => {
    const el = wizardDialogRef.current;
    if (!el) {
      return;
    }
    if (wizardVisible) {
      if (!el.open) {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [wizardVisible]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="grid">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Facturación React</span>
          <span className="text-sm font-semibold">{shellTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleLogout} aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggle}
            aria-label={isDark ? "Modo claro" : "Modo oscuro"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
            <Menu className="h-4 w-4" />
          </Button>
        </div>
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
            <SidebarContent
              collapsed={false}
              isDark={isDark}
              toggle={toggle}
              sandbox={sandbox}
              toggleSandbox={toggleSandbox}
              onNavigate={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
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
          <SidebarContent
            collapsed={collapsed}
            isDark={isDark}
            toggle={toggle}
            sandbox={sandbox}
            toggleSandbox={toggleSandbox}
            onLogout={handleLogout}
          />
        </aside>

        <main className="min-h-[calc(100vh-57px)] w-full min-w-0 flex-1 lg:min-h-screen">
          {sandbox ? (
            <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              Modo prueba activo — los documentos no se guardan en producción
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>

      <dialog
        ref={wizardDialogRef}
        className="fixed left-1/2 top-1/2 z-[60] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-auto bg-background text-foreground shadow-lg backdrop:bg-black/50"
        style={{ borderRadius: 8, padding: 24, maxWidth: 420, width: "90vw", border: "1px solid #ccc" }}
        onClose={() => {
          try {
            localStorage.setItem("facturacion-wizard-seen", "1");
          } catch {}
          setWizardVisible(false);
          setWizardStep(0);
        }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          {wizardStep === 0 ? (
            <>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>¡Bienvenido a Facturación!</h2>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#666" }}>
                Antes de crear tu primera factura, configura el emisor y la plantilla.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button type="button" onClick={() => setWizardStep(1)}>
                  Empezar →
                </Button>
              </div>
            </>
          ) : null}
          {wizardStep === 1 ? (
            <>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Paso 1: Configura el emisor</h2>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#666" }}>
                Ve a Configuración para rellenar los datos de tu empresa y el logo.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button type="button" variant="ghost" onClick={() => setWizardStep(2)}>
                  Omitir
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    navigate("/configuracion");
                    wizardDialogRef.current?.close();
                  }}
                >
                  Ir a Configuración
                </Button>
              </div>
            </>
          ) : null}
          {wizardStep === 2 ? (
            <>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Paso 2: Factura</h2>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#666" }}>
                Ya puedes crear tu primera factura en la sección Facturar.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button type="button" variant="ghost" onClick={() => wizardDialogRef.current?.close()}>
                  Cerrar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    navigate("/facturar");
                    wizardDialogRef.current?.close();
                  }}
                >
                  Ir a Facturar
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}

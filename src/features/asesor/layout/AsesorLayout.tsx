import { FileSpreadsheet } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { cn } from "@/lib/utils";

function subLinkClass(isActive: boolean): string {
  return cn(
    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground",
  );
}

export function AsesorLayout() {
  const sessionQuery = useSessionQuery();
  const isAdmin =
    Boolean(sessionQuery.data?.authenticated) &&
    String(sessionQuery.data?.user?.role || "").trim().toLowerCase() === "admin";

  if (!sessionQuery.data?.authenticated) {
    return null;
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Asesor</h1>
          <p className="text-informative">Solo los administradores pueden acceder a las exportaciones de asesoría.</p>
        </header>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-7 w-7 text-informative" aria-hidden />
          <h1 className="text-2xl font-semibold">Asesor</h1>
        </div>
        <p className="text-informative">
          Resumen compartible para terceros, exportación Excel Celia y libro de control con facturas y gastos.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-border pb-4" aria-label="Secciones Asesor">
        <NavLink to="resumen" className={({ isActive }) => subLinkClass(isActive)}>
          Resumen
        </NavLink>
        <NavLink to="celia" className={({ isActive }) => subLinkClass(isActive)}>
          Excel Celia
        </NavLink>
        <NavLink to="libro" className={({ isActive }) => subLinkClass(isActive)}>
          Libro de control
        </NavLink>
      </nav>

      <Outlet />
    </main>
  );
}

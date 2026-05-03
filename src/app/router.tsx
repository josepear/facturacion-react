import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "@/app/AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { ClientsPage } from "@/features/clients/pages/ClientsPage";
import { DataPage } from "@/features/data/pages/DataPage";
import { ExpensesPage } from "@/features/expenses/pages/ExpensesPage";
import { HistoryPage } from "@/features/history/pages/HistoryPage";
import { FacturarPage } from "@/features/invoices/pages/FacturarPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

// In production the app is served at /react/ by the legacy Node server.
// Vite sets import.meta.env.BASE_URL to "/" in dev and "/react/" in prod builds.
export const router = createBrowserRouter(
  [
    {
      path: "/login",
      element: <LoginPage />,
    },
    {
      path: "/",
      element: (
        <RequireAuth>
          <AppShell />
        </RequireAuth>
      ),
      children: [
        {
          index: true,
          element: <Navigate to="/facturar" replace />,
        },
        {
          path: "facturar",
          element: <FacturarPage />,
        },
        {
          path: "clientes",
          element: <ClientsPage />,
        },
        {
          path: "historial",
          element: <HistoryPage />,
        },
        {
          path: "gastos",
          element: <ExpensesPage />,
        },
        {
          path: "datos",
          element: <DataPage />,
        },
        {
          path: "configuracion",
          element: <SettingsPage />,
        },
        {
          path: "*",
          element: <NotFoundPage />,
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" },
);

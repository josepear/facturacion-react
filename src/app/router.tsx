import { lazy } from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";

import { AppShell } from "@/app/AppShell";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AsesorLayout } from "@/features/asesor/layout/AsesorLayout";
import { AsesorCeliaPage } from "@/features/asesor/pages/AsesorCeliaPage";
import { AsesorLibroPage } from "@/features/asesor/pages/AsesorLibroPage";
import { AsesorResumenPage } from "@/features/asesor/pages/AsesorResumenPage";
import { DataPage } from "@/features/data/pages/DataPage";
import { SharedReportPublicPage } from "@/pages/SharedReportPublicPage";

const LoginPage = lazy(() => import("@/features/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const FacturarPage = lazy(() => import("@/features/invoices/pages/FacturarPage").then((m) => ({ default: m.FacturarPage })));
const ClientsPage = lazy(() => import("@/features/clients/pages/ClientsPage").then((m) => ({ default: m.ClientsPage })));
const HistoryPage = lazy(() => import("@/features/history/pages/HistoryPage").then((m) => ({ default: m.HistoryPage })));
const ExpensesPage = lazy(() => import("@/features/expenses/pages/ExpensesPage").then((m) => ({ default: m.ExpensesPage })));
const SettingsPage = lazy(() => import("@/features/settings/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const CalculatorPage = lazy(() =>
  import("@/features/utilities/calculator/CalculatorPage").then((m) => ({ default: m.CalculatorPage })),
);

function IndexRedirectToFacturar() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: "/facturar", search }} replace />;
}

// In production the app is served at /react/ by the legacy Node server.
// Vite sets import.meta.env.BASE_URL to "/" in dev and "/react/" in prod builds.
export const router = createBrowserRouter(
  [
    {
      path: "/login",
      element: <LoginPage />,
    },
    {
      path: "/informe-compartido",
      element: <SharedReportPublicPage />,
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
          element: <IndexRedirectToFacturar />,
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
          path: "asesor",
          element: <AsesorLayout />,
          children: [
            { index: true, element: <Navigate to="resumen" replace /> },
            { path: "resumen", element: <AsesorResumenPage /> },
            { path: "celia", element: <AsesorCeliaPage /> },
            { path: "libro", element: <AsesorLibroPage /> },
          ],
        },
        {
          path: "configuracion",
          element: <SettingsPage />,
        },
        {
          path: "utilidades/calculadora",
          element: <CalculatorPage />,
        },
        {
          path: "*",
          element: <Navigate to="/facturar" replace />,
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" },
);

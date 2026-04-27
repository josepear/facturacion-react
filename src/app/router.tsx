import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "@/app/AppShell";
import { ClientsPage } from "@/features/clients/pages/ClientsPage";
import { ExpensesPage } from "@/features/expenses/pages/ExpensesPage";
import { HistoryPage } from "@/features/history/pages/HistoryPage";
import { FacturarPage } from "@/features/invoices/pages/FacturarPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
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
        path: "configuracion",
        element: <SettingsPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

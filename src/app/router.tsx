import { createBrowserRouter } from "react-router-dom";

import { FacturarPage } from "@/features/invoices/pages/FacturarPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <FacturarPage />,
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

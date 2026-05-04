import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";
import "@/styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <Suspense fallback={<p className="p-4 text-muted-foreground">Cargando…</p>}>
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  </StrictMode>,
);

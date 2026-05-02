import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const proxyTarget = process.env.E2E_API_TARGET || "https://facturacion.pearandco.es";

/** Mismo destino en `vite` (dev) y `vite preview`: sin esto, `/api/*` en preview cae al fallback SPA y devuelve HTML. */
const apiProxy = {
  "/api": {
    target: proxyTarget,
    changeOrigin: true,
    secure: false,
  },
  /** Auth vive fuera de `/api`; en dev/preview el `fetch` va al mismo origen que Vite, hay que proxyar. */
  "/login": {
    target: proxyTarget,
    changeOrigin: true,
    secure: false,
  },
};

export default defineConfig({
  plugins: [react()],
  // In production the legacy Node server serves the React app at /react/
  base: process.env.NODE_ENV === "production" ? "/react/" : "/",
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "src"),
      react: path.resolve(__dirname, "../node_modules/react"),
      "react/jsx-runtime": path.resolve(__dirname, "../node_modules/react/jsx-runtime.js"),
      "react-dom": path.resolve(__dirname, "../node_modules/react-dom"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: [...configDefaults.exclude, "**/e2e/**"],
    css: true,
    server: {
      deps: {
        inline: ["react", "react-dom", "react-router", "react-router-dom", "react-hook-form", "@tanstack/react-query"],
      },
    },
  },
});

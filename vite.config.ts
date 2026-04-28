import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.E2E_API_TARGET || "https://facturacion.pearandco.es",
        changeOrigin: true,
        secure: false,
      },
    },
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

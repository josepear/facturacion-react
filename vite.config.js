var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
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
        exclude: __spreadArray(__spreadArray([], configDefaults.exclude, true), ["**/e2e/**"], false),
        css: true,
        server: {
            deps: {
                inline: ["react", "react-dom", "react-router", "react-router-dom", "react-hook-form", "@tanstack/react-query"],
            },
        },
    },
});

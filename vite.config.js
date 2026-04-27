import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
    plugins: [react()],
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
        css: true,
        server: {
            deps: {
                inline: ["react", "react-dom", "react-router", "react-router-dom", "react-hook-form", "@tanstack/react-query"],
            },
        },
    },
});

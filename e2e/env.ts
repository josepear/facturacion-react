import path from "node:path";

import dotenv from "dotenv";

const envPath = path.resolve(process.cwd(), ".env.e2e");
dotenv.config({ path: envPath, override: false });

export const e2eEnv = {
  apiTarget: String(process.env.E2E_API_TARGET || "https://facturacion.pearandco.es").trim(),
  baseUrl: String(process.env.E2E_BASE_URL || `http://127.0.0.1:${process.env.E2E_PORT || "4173"}`).trim(),
  port: Number(process.env.E2E_PORT || 4173),
  requireExpenseWrite: String(process.env.E2E_REQUIRE_EXPENSE_WRITE || "true").trim().toLowerCase() !== "false",
};


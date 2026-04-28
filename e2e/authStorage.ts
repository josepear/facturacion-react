import fs from "node:fs";
import path from "node:path";

export const AUTH_DIR = path.resolve(process.cwd(), "e2e/.auth");
export const BEARER_PATH = path.join(AUTH_DIR, "bearer");
export const USER_STORAGE_PATH = path.join(AUTH_DIR, "user.json");

export function writeBearerFile(token: string) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(BEARER_PATH, token.trim(), "utf8");
}

export function readBearerFile(): string {
  const token = fs.readFileSync(BEARER_PATH, "utf8").trim();
  if (!token) {
    throw new Error(`E2E: ${BEARER_PATH} está vacío o no existe. Revisa el login en global-setup / auth.setup.`);
  }
  return token;
}

#!/usr/bin/env node
/**
 * Lee un facturacion.config.json (legacy o copia de prod) y escribe artefactos
 * para migrar emisores a la SPA React (mismo backend: POST /api/template-profiles).
 *
 * Monorepo Node (server + facturacion.config.json en raíz):
 *   /Volumes/RAID/Repos/apps/facturacion
 * Ejemplo de fichero legacy hermano del subrepo React:
 *   ../facturacion.config.json.backup-2024
 *
 * Extraer solo (local):
 *   node scripts/extract-template-profiles-from-config.mjs /ruta/a/facturacion.config.json --out-dir ./tmp-migracion
 *
 * Aplicar en servidor (tú ejecutas en tu máquina; requiere token admin):
 *   FACTURACION_API_BASE=https://facturacion.pearandco.es FACTURACION_TOKEN=... \\
 *     node scripts/extract-template-profiles-from-config.mjs /ruta/LEGACY.json --apply
 *
 * Por defecto --apply hace fusión: GET /api/config + añade perfiles del legacy cuyo id
 * aún no existe en el servidor (no borra los actuales). Para sustituir TODO el listado
 * por el del legacy (peligroso): añade --replace-all-profiles.
 *
 * --dry-run con --apply: muestra el cuerpo del POST sin enviarlo.
 *
 * Usuarios como editores: sigue generando users-as-editors.json; --keep-password-fields
 * solo para volcado local seguro (nunca subas a git).
 */

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const positionals = [];
  let outDir = process.cwd();
  let keepPasswords = false;
  let apply = false;
  let replaceAll = false;
  let dryRun = false;
  let apiBase = (process.env.FACTURACION_API_BASE || "").replace(/\/$/, "");
  let token = process.env.FACTURACION_TOKEN || "";

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keep-password-fields") {
      keepPasswords = true;
      continue;
    }
    if (a === "--apply") {
      apply = true;
      continue;
    }
    if (a === "--replace-all-profiles") {
      replaceAll = true;
      continue;
    }
    if (a === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (a === "--out-dir") {
      outDir = path.resolve(argv[++i] ?? "");
      continue;
    }
    if (a.startsWith("--out-dir=")) {
      outDir = path.resolve(a.slice("--out-dir=".length));
      continue;
    }
    if (a === "--api-base") {
      apiBase = (argv[++i] ?? "").replace(/\/$/, "");
      continue;
    }
    if (a.startsWith("--api-base=")) {
      apiBase = a.slice("--api-base=".length).replace(/\/$/, "");
      continue;
    }
    if (a === "--token") {
      token = argv[++i] ?? "";
      continue;
    }
    if (a.startsWith("--token=")) {
      token = a.slice("--token=".length);
      continue;
    }
    if (a.startsWith("--")) {
      console.error("Flag desconocido:", a);
      process.exit(1);
    }
    positionals.push(a);
  }

  return { positionals, outDir, keepPasswords, apply, replaceAll, dryRun, apiBase, token };
}

async function fetchJson(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const msg = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${msg}`);
  }
  return parsed;
}

function usage() {
  console.error(`Uso:
  node scripts/extract-template-profiles-from-config.mjs <facturacion.config.json> \\
    [--out-dir ./dir] [--keep-password-fields]

  Añadir perfiles del legacy al servidor (admin), fusionando por id (por defecto):
    FACTURACION_API_BASE=https://tu-host FACTURACION_TOKEN=<Bearer> \\
      node scripts/extract-template-profiles-from-config.mjs <LEGACY.json> --apply

  Opciones --apply:
    --api-base URL   (si no usas FACTURACION_API_BASE)
    --token TOKEN    (si no usas FACTURACION_TOKEN; evita en shared hosts: queda en historial)
    --replace-all-profiles   POST solo el listado del legacy (sustituye el bloque entero)
    --dry-run                imprime el JSON del POST sin enviarlo`);
}

const args = process.argv.slice(2);
const { positionals, outDir, keepPasswords, apply, replaceAll, dryRun, apiBase, token } = parseArgs(args);

if (positionals.length !== 1) {
  usage();
  process.exit(1);
}

const abs = path.resolve(positionals[0]);
const raw = fs.readFileSync(abs, "utf8");
const cfg = JSON.parse(raw);

if (!Array.isArray(cfg.templateProfiles)) {
  console.error("El JSON no contiene templateProfiles[] (array). Revisa el fichero.");
  process.exit(2);
}

const profiles = cfg.templateProfiles;
const active = String(cfg.activeTemplateProfileId || profiles[0]?.id || "").trim() || String(profiles[0]?.id || "");

const templatePayload = {
  activeTemplateProfileId: active,
  templateProfiles: profiles,
};

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const templateOut = path.join(outDir, "template-profiles-for-post.json");
fs.writeFileSync(templateOut, JSON.stringify(templatePayload, null, 2), "utf8");
console.log(`Escrito: ${templateOut}`);

if (Array.isArray(cfg.users)) {
  const usersOut = path.join(outDir, "users-as-editors.json");
  const mapped = cfg.users.map((u) => {
    const next = { ...u, role: "editor" };
    if (!keepPasswords) {
      for (const k of ["password", "passwordHash", "hash", "pwd"]) {
        if (k in next) {
          delete next[k];
        }
      }
    }
    if (!Array.isArray(next.allowedTemplateProfileIds)) {
      next.allowedTemplateProfileIds = [];
    }
    return next;
  });
  fs.writeFileSync(usersOut, JSON.stringify({ users: mapped }, null, 2), "utf8");
  console.log(`Escrito: ${usersOut}`);
  if (!keepPasswords) {
    console.log("");
    console.log("Aviso: users-as-editors.json NO incluye contraseñas. Para conservar logins al fusionar");
    console.log("  en facturacion.config.json en el mini, copia role/allowedTemplateProfileIds desde este");
    console.log("  fichero sobre el users[] original, o vuelve a ejecutar con --keep-password-fields");
    console.log("  (solo en máquina segura; no subas ese archivo a git).");
  }
} else {
  console.log("(No hay users[] en este JSON; ignora usuarios o añade la clave en legacy.)");
}

console.log("");
console.log(`Origen leído: ${abs} (${profiles.length} emisor(es) en legacy)`);

if (!apply) {
  console.log("");
  console.log("Siguiente paso (emisores en React):");
  console.log("  • POST /api/template-profiles con el JSON de arriba (admin), o fusionar en");
  console.log("    facturacion.config.json en el servidor; o ejecuta de nuevo con --apply.");
  console.log("  • La SPA en /react/configuracion lee GET /api/config.");
  process.exit(0);
}

if (!apiBase || !token) {
  console.error("");
  console.error("Falta FACTURACION_API_BASE / FACTURACION_TOKEN o --api-base / --token para --apply.");
  process.exit(3);
}

let bodyToPost;

if (replaceAll) {
  console.log("");
  console.warn("⚠  --replace-all-profiles: el POST sustituirá templateProfiles por SOLO los del legacy.");
  bodyToPost = templatePayload;
} else {
  const configUrl = `${apiBase}/api/config`;
  console.log("");
  console.log(`GET ${configUrl} …`);
  const remote = await fetchJson(configUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!remote || typeof remote !== "object" || !Array.isArray(remote.templateProfiles)) {
    console.error("Respuesta de /api/config inválida o sin templateProfiles[].");
    process.exit(4);
  }
  const remoteProfiles = remote.templateProfiles;
  const remoteIds = new Set(remoteProfiles.map((p) => String(p?.id ?? "")));
  const added = [];
  for (const p of profiles) {
    const id = String(p?.id ?? "");
    if (!id) continue;
    if (remoteIds.has(id)) {
      console.log(`  (omitido legacy id ya en servidor: ${id})`);
      continue;
    }
    remoteIds.add(id);
    added.push(p);
  }
  const merged = [...remoteProfiles, ...added];
  const activeRemote = String(remote.activeTemplateProfileId || remoteProfiles[0]?.id || "").trim();
  bodyToPost = {
    activeTemplateProfileId: activeRemote || merged[0]?.id || "",
    templateProfiles: merged,
  };
  console.log(`Fusión: ${remoteProfiles.length} en servidor + ${added.length} nuevo(s) desde legacy → ${merged.length} total.`);
}

const postUrl = `${apiBase}/api/template-profiles`;

if (dryRun) {
  console.log("");
  console.log("--dry-run: cuerpo del POST (no enviado):");
  console.log(JSON.stringify(bodyToPost, null, 2));
  process.exit(0);
}

console.log("");
console.log(`POST ${postUrl} …`);
await fetchJson(postUrl, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: bodyToPost,
});
console.log("Listo: perfiles guardados en el servidor. Revisa /react/configuracion.");

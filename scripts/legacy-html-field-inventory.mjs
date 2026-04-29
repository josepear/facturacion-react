#!/usr/bin/env node
/**
 * Inventario de campos `name="..."` del HTML legacy, agrupados por pestaña
 * (`data-tab-panel` más reciente en el barrido).
 *
 * Uso (desde la raíz de facturacion-react):
 *   npm run inventory:legacy
 *   npm run inventory:legacy -- /ruta/al/index.html
 *   npm run inventory:legacy -- --markdown   # tabla para pegar en docs
 *
 * Por defecto lee ../public/index.html respecto a este repo (monorepo facturacion).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reactRoot = path.resolve(__dirname, "..");
const defaultLegacyHtml = path.resolve(reactRoot, "..", "public", "index.html");

const argv = process.argv.slice(2);
const wantMarkdown = argv.includes("--markdown");
const htmlPath = argv.filter((a) => a !== "--markdown")[0] || defaultLegacyHtml;

if (!fs.existsSync(htmlPath)) {
  console.error(`No se encuentra el HTML legacy: ${htmlPath}`);
  console.error("Pasa la ruta a public/index.html del monorepo o coloca facturacion junto a facturacion-react.");
  process.exit(1);
}

const raw = fs.readFileSync(htmlPath, "utf8");
const lines = raw.split(/\r?\n/);

let panel = "_before_tabs";
/** @type {Record<string, Array<{ name: string; line: number; hidden: boolean; type: string | null }>>} */
const byPanel = {};

function ensurePanel(p) {
  if (!byPanel[p]) {
    byPanel[p] = [];
  }
}

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  const lineNo = i + 1;
  const panelMatch = line.match(/data-tab-panel="([^"]+)"/);
  if (panelMatch) {
    panel = panelMatch[1];
  }

  if (/^\s*<meta\b/i.test(line)) {
    continue;
  }
  const nameRegex = /\bname="([^"]+)"/g;
  let m;
  while ((m = nameRegex.exec(line)) !== null) {
    const name = m[1];
    const hidden = /\btype\s*=\s*["']hidden["']/i.test(line);
    const typeMatch = line.match(/\btype\s*=\s*["']([^"']+)["']/i);
    ensurePanel(panel);
    byPanel[panel].push({
      name,
      line: lineNo,
      hidden,
      type: typeMatch ? typeMatch[1].toLowerCase() : null,
    });
  }
}

const flatNames = [...new Set(Object.values(byPanel).flatMap((entries) => entries.map((e) => e.name)))].sort();

const report = {
  generatedAt: new Date().toISOString(),
  sourceHtml: path.resolve(htmlPath),
  panels: byPanel,
  uniqueNames: flatNames,
  countsByPanel: Object.fromEntries(
    Object.entries(byPanel).map(([k, v]) => [k, v.length]),
  ),
};

if (wantMarkdown) {
  console.log("# Inventario legacy `name=` por pestaña\n");
  console.log(`Fuente: \`${report.sourceHtml}\`\n`);
  for (const [p, entries] of Object.entries(byPanel).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`## Panel \`${p}\` (${entries.length} apariciones)\n`);
    console.log("| name | línea | type | hidden |");
    console.log("| --- | ---: | --- | --- |");
    for (const e of entries) {
      console.log(`| \`${e.name}\` | ${e.line} | ${e.type ?? "—"} | ${e.hidden ? "sí" : "no"} |`);
    }
    console.log("");
  }
  console.log("## Nombres únicos (ordenados)\n");
  console.log(flatNames.map((n) => `- \`${n}\``).join("\n"));
} else {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

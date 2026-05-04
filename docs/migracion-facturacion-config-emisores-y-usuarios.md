# Migrar emisores y usuarios desde `facturacion.config.json` (legacy) hacia React

La SPA React **no guarda** emisores en su propio almacén: usa el **mismo servidor** que la UI legacy. Los emisores (plantillas / perfiles) viven en **`templateProfiles`** dentro de `facturacion.config.json`; los logins y roles suelen ir en **`users[]`** del mismo fichero (ver `authController` / docs de paridad).

## Por qué «desaparecieron» si antes estaban en commits

En **abril 2026** el commit `028b1df` (*Preparar proyecto Facturacion para GitHub*) **quitó `facturacion.config.json` del árbol de git** (sustituido por `facturacion.config.example.json` y entrada en `.gitignore` para no publicar secretos y rutas locales). Los **cuatro perfiles** (José, Desirée, Nacho, Mari Ángeles) **siguen en el historial** en el padre de ese commit:

```bash
cd /Volumes/RAID/Repos/apps/facturacion
git show '028b1df^:facturacion.config.json' | python3 -c "import sys,json; d=json.load(sys.stdin); print([p.get('label') for p in d.get('templateProfiles',[])])"
```

Lo que usa la app es el **`facturacion.config.json` en disco** (RAID o Mac mini), no git. Si ese fichero se machacó, se redujo a un solo perfil o se restauró desde un ejemplo, en runtime «desaparecen» aunque git conserve el histórico.

En el monorepo hay un script que **fusiona por `id`** los perfiles históricos en tu config local (no toca producción por sí solo):

```bash
cd /Volumes/RAID/Repos/apps/facturacion
python3 scripts/recover-profiles.py
```

Luego reinicia el servidor si hace falta y/o despliega el JSON actualizado al mini según vuestra ops.

## Dónde está el backend y el JSON

Monorepo (Node + `server.mjs` + `facturacion.config.json` en la raíz):

`/Volumes/RAID/Repos/apps/facturacion`

(`facturacion-react` es la subcarpeta `…/apps/facturacion/facturacion-react/`. Si acostumbráis a escribir `/RAID/Repos/...`, es la misma unidad bajo `/Volumes/RAID/...`.)

**Comportamiento del servidor:** `POST /api/template-profiles` llama a `saveTemplateProfilesConfig` en `server.mjs`: el cuerpo **`templateProfiles` sustituye por completo** el array guardado en disco (no hace merge en servidor). Por eso el script con **`--apply` sin `--replace-all-profiles`** hace antes un `GET /api/config` y **fusiona en cliente** (ids ya existentes se mantienen desde el servidor; del legacy solo se añaden ids nuevos).

Objetivo típico: **recuperar Desi, Nacho, Mari Ángeles** (u otros) desde una copia antigua del JSON y que la app en **`/react/configuracion`** los vea; además dejar a **todos los miembros como `editor`** (sin dar de alta admin por error en todos).

## 1. Copia de seguridad

Antes de tocar producción:

1. Copia el `facturacion.config.json` actual del Mac mini (o donde corra el servicio).
2. Guarda también la copia **legacy** de la que vas a extraer (`facturacion.config.json` viejo, Time Machine, etc.).

## 2. Extraer `templateProfiles` (emisores)

Desde la raíz de `facturacion-react`:

```bash
node scripts/extract-template-profiles-from-config.mjs /ruta/al/facturacion.config.json.LEGACY --out-dir ./tmp-migracion
```

Genera:

| Fichero | Contenido |
|---------|-------------|
| `tmp-migracion/template-profiles-for-post.json` | Cuerpo listo para **`POST /api/template-profiles`**: `activeTemplateProfileId` + `templateProfiles[]`. |

### Opción A — Fusionar en el servidor (recomendado si controláis el disco)

1. Abrí el `facturacion.config.json` **activo** del runtime.
2. Sustituí o fusioná el array **`templateProfiles`** con el del legacy (revisá que no haya **ids duplicados**; el `activeTemplateProfileId` debe existir en la lista).
3. Reiniciá el proceso Node (LaunchAgent) para recargar el JSON.
4. En el navegador: **`/react/configuracion`** → deberían aparecer todos los emisores.

### Opción B — Vía API (admin)

Con sesión **administrador**, enviad el cuerpo de `template-profiles-for-post.json` a:

`POST /api/template-profiles`

(mismo contrato que usa «Guardar datos del emisor» en React). El servidor **persiste el array completo** que enviéis: hay que incluir **todos** los perfiles que debáis conservar, no solo los recuperados del legacy (o usad el script con `--apply` en modo fusión).

### Opción C — Mismo script, aplicando en el servidor (desde tu terminal)

El agente de Cursor **no puede** llamar a tu dominio ni usar tu token; vosotros sí, en local:

1. Obtené un **Bearer** de administrador (login en la app o `POST /login` como en el README).
2. Ejecutad (fusiona por **id**: mantiene los perfiles que ya hay en el servidor y **añade** del legacy los que tengan id nuevo):

```bash
export FACTURACION_API_BASE=https://facturacion.pearandco.es
export FACTURACION_TOKEN='el_token_jwt'
npm run config:extract-profiles -- /ruta/al/facturacion.config.json.LEGACY --out-dir ./tmp-migracion --apply
```

- **`--dry-run`** junto con **`--apply`**: imprime el JSON del `POST` sin enviarlo.
- **`--replace-all-profiles`** con **`--apply`**: el cuerpo del POST es **solo** el listado del legacy (equivalente a machacar el bloque entero; usad solo si eso es lo que queréis).

Si un id del legacy **ya existe** en el servidor, en modo fusión se **omite** esa entrada del legacy (no sobrescribe). Para cambiar datos de un perfil existente, editad en React o fusionad a mano en el JSON del servidor.

## 3. Poner a **todos** como **editores**

En el **`users[]`** del `facturacion.config.json` que vaya a ser el **canónico** en el mini:

- Poned **`role`** (o el campo equivalente que use vuestro `authController`) a **`editor`** en cada usuario que no deba ser administrador.
- **`allowedTemplateProfileIds`**: vacío `[]` suele significar «todos los emisores» en la mentalidad de la app; si en vuestro JSON legacy tenéis listas explícitas, copiadlas o ampliadlas para incluir los ids de Desi / Nacho / Mari Ángeles tras el merge.

El script opcional escribe **`users-as-editors.json`** (misma carpeta `--out-dir`) con `role: "editor"` y **sin** campos de contraseña por defecto, para que podáis ver el diff sobre metadatos sin filtrar secretos a un repo. Para **conservar hashes** al pegar en el servidor:

```bash
node scripts/extract-template-profiles-from-config.mjs /ruta/legacy.json --out-dir ./tmp-migracion --keep-password-fields
```

(trabajar solo en máquina segura; **no** subir ese JSON a git).

Si tras el merge alguien no puede entrar, resetead contraseña desde la UI de miembros (admin) o restaurad el `users[]` desde backup.

## 4. React y «meter en React»

No hace falta un import mágico en el cliente: **si el `facturacion.config.json` del servidor tiene los `templateProfiles`**, `GET /api/config` ya los sirve y Facturar / Configuración React los consumen.

La pantalla **Emisores** en React sirve para **editar y guardar** lo mismo que legacy en pestaña Personal; el origen de verdad sigue siendo el JSON en disco (salvo que uséis solo la API).

## 5. Comprobar

1. `GET /api/config` (con sesión): comprobad `templateProfiles` y `activeTemplateProfileId`.
2. `GET /api/session`: comprobad roles.
3. Navegador: **`/react/configuracion`** y **`/react/facturar`** con distintos emisores.

## Referencias

- Tipos: `TemplateProfileConfig` en `src/domain/document/types.ts`.
- API emisores (cliente): `saveTemplateProfilesConfig` → `POST /api/template-profiles` en `src/infrastructure/api/documentsApi.ts`.
- Servidor: `../server.mjs` — `saveTemplateProfilesConfig` y ruta `POST /api/template-profiles`.
- Miembros: `src/infrastructure/api/usersApi.ts` (`/api/users` — confirmar en `server.mjs` desplegado).
- Paridad legacy: `docs/parity-anti-invent-candidates.md` (sección miembros / `users[]`).

# UI: color de texto y colores del Historial (2026-11-19)

Cambios de estilo de la **app React** (no afectan a la plantilla del documento/PDF).

## Color de texto de la app

En `src/styles/tokens.css` (tema claro) los tokens de **texto** valen `#1e1e1e`
(HSL `0 0% 11.76%`):

- `--foreground` (cuerpo)
- `--card-foreground` (tarjetas)
- `--muted-foreground` (lo que usan `text-informative` / `text-muted-foreground`)
- `--accent-foreground`

Se mantienen, a propósito, para contraste/significado:

- `--primary-foreground` y texto sobre superficies primarias/activas.
- Colores semánticos (`text-danger`, `text-success`, `text-warning`) y el acento `text-primary`.
- **Modo oscuro** intacto (texto oscuro sobre fondo oscuro sería ilegible).

## Colores de las filas del Historial

En `src/features/history/pages/HistoryPage.tsx`, cada fila (`<li>`) se tiñe según el tipo:

| Tipo | Fondo (claro) | Fondo (oscuro) |
| --- | --- | --- |
| Factura | `#CFD8DC` | `#CFD8DC` al 15% |
| Presupuesto | `#FFF176` | `#FFF176` al 15% |

- El bloque de acciones de la fila va **transparente** para que el fondo sea continuo.
- En la fila activa, la columna del checkbox también toma el color primario para que el fondo
  quede uniforme.
- Estos colores son **solo de la UI** del listado; no se aplican al documento (HTML/PDF).

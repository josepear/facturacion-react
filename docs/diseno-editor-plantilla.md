# Editor de diseño (pestaña «Diseño»)

Réplica en React de la pestaña **Diseño** del legacy: controla cómo salen las facturas y los
presupuestos (plantilla, tipografías, colores, medidas y alineaciones del PDF). Hasta ahora React
solo gestionaba `layout`, `colorKey` y `fontFamily`; el resto de controles no existían.

- Ruta: **`/diseno`** (menú lateral, «Diseño»).
- Página: `src/features/design/pages/DesignPage.tsx`.
- Modelo y valores: `src/domain/design/designConfig.ts`.

## Qué permite editar

| Bloque | Controles |
| --- | --- |
| Emisor y documento | Emisor (perfil), tipo de documento (factura/presupuesto), plantilla PDF (`pear`, `editorial`, `voulita`), colores de acento y oscuro. |
| Logo | Ancho (mm), justificación horizontal y vertical. |
| Servicios | Fuente Google, peso, tamaño (pt), alineaciones, texto del bloque superior y visibilidad. |
| Título | Fuente Google, peso, ancho/alto de la caja (mm), alineaciones. |
| Proyecto | Caja del nombre del proyecto **ajustada al texto** (sin anchura manual): tamaño del texto (6–18 pt) y alineación horizontal. |
| Ajustes finos | Datos superiores (tamaño fecha/número, alineaciones emisor/fecha/cliente), lateral y contenido (columna izquierda, textos base/detalle/título/concepto, alineaciones), pie y cobro (slogan, peso del número de cuenta, alineaciones del pie y del bloque de cobro), pie y cierre (URL, slogans y nota). |

Los valores por defecto (`DEFAULT_DESIGN`) y los clamps son una **copia exacta** de
`public/modules/document-core.mjs` (`DEFAULT_DESIGN` / `normalizeDesign`). Si cambian allí, hay que
cambiarlos aquí.

## Cómo se guarda

- Se edita **por emisor** y **por tipo de documento**: factura → `profile.design`; presupuesto →
  `profile.designPresupuesto` (si no existe, se parte del diseño de factura).
- Los textos del bloque de servicios y del pie (`referenceTopCopy`, `footerUrl`, `footerSloganTop`,
  `footerSloganBottom`, `footerNote`, `showReferenceTopCopy`) viven en `profile.business`.
- Se guarda con el mismo contrato que el legacy: `POST /api/template-profiles` enviando
  `{ activeTemplateProfileId, templateProfiles }` (`saveTemplateProfilesConfig`).
- El payload parte de los perfiles que devuelve `GET /api/config`, así que **no se pierden campos**
  que React no edite (business/defaults/tenantId/invoiceNumberTag…).

## Vista previa en vivo

`POST /api/documents/preview-html` con dos marcas nuevas:

```json
{
  "document": { "...": "muestra con el design del borrador" },
  "useDocumentDesign": true,
  "businessOverride": { "footerSloganTop": "…", "footerNote": "…" }
}
```

- `useDocumentDesign: true` → el backend usa `document.design` en vez del diseño guardado en el
  perfil (`bindDocumentToTemplateProfile` en `server.mjs`).
- `businessOverride` → superpone textos de emisor para la previsualización
  (`renderBoundDocumentHtml`). Solo se aplica junto con `useDocumentDesign`.

Sin esas marcas el comportamiento es el de siempre (documentos guardados, PDF, Gmail y enlaces
públicos siguen usando el diseño del perfil). El cliente lo encapsula en
`fetchDesignPreviewBlob` (`src/infrastructure/api/documentsApi.ts`).

## Relación con Facturar

`FacturarPage` no envía diseño propio: el servidor impone el diseño del perfil al guardar y al
renderizar. Por eso lo que se configure aquí es exactamente lo que sale en la vista previa, el HTML
oficial, el PDF y el PDF adjunto por Gmail.

## Verificación

- React: `src/domain/design/designConfig.test.ts` (defaults, clamps, migración, layouts) y
  `src/features/design/pages/DesignPage.test.tsx` (guardado en `design` / `designPresupuesto`,
  estado «sucio», vista previa con el borrador, estilo base).
- Backend: `tests/server-preview-design-override.test.mjs` (preview con diseño del borrador y
  `businessOverride`; sin la marca usa el diseño del perfil).

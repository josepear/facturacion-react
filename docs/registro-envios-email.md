# Registro de envíos por email (Gmail) en la app

Cuando se envía un documento por Gmail desde la app, el servidor guarda un **registro del último
envío** en el propio documento. La app lo muestra en el Historial, de modo que no dependes de que el
correo aparezca en la carpeta «Enviados» de una cuenta concreta.

## Qué se guarda

`POST /api/gmail/send-invoice` escribe en el JSON del documento (nivel raíz) un objeto
`gmailLastSend` y lo devuelve en la respuesta:

```json
{
  "sentAt": "2026-11-19T08:12:00.000Z",
  "messageId": "…",
  "to": "asesor@example.com, cliente@example.com",
  "senderTemplateProfileId": "perfil-main",
  "fromEmail": "facturas@example.com",
  "batchRecordIds": ["docs/2026/f-1.json", "docs/2026/f-2.json"],
  "batchCount": 2
}
```

- Envío individual: solo los campos del destinatario y del mensaje.
- Envío por lotes: añade `batchRecordIds` y `batchCount` (se registra el mismo envío en cada documento).

## Dónde se ve en la app

- **Historial → listado**: en la línea del documento aparece `· Enviado 19/11/26, 8:12`
  (con el detalle en el `title`).
- **Historial → detalle**: línea **«Último envío»** con destinatarios, fecha/hora y número de
  documentos si fue un lote.
- **Facturar / Historial (mensaje tras enviar)**: «Enviado a … · fecha».
- Tras enviar se refrescan el listado y el detalle, así que el registro aparece al instante.

El endpoint del listado (`GET /api/history`) incluye `gmailLastSend` por fila; el detalle
(`GET /api/documents/detail`) no lo devuelve, por eso la vista usa la fila del listado.

## Persistencia al volver a guardar

El guardado de documentos (`persistDocument` en `server.mjs`) reescribe el JSON. Para que el
registro no se pierda al editar y guardar de nuevo, el servidor **copia `gmailLastSend`** del JSON
anterior al nuevo (cambio aplicado en el runtime el 2026-11-19).

> Nota: `server.mjs` vive en el runtime (`/Users/josemendoza/facturacion-app`) y no está versionado
> en este repo. Este ajuste debe trasladarse al repositorio del backend cuando exista.

## Limitaciones

- Se guarda **el último envío**, no un histórico completo. Para un log de todos los envíos habría
  que añadir en el backend un array (`gmailSendLog`) o un endpoint de auditoría; el frontend ya
  queda preparado para consumir `gmailLastSend`.
- La carpeta «Enviados» del correo depende de la cuenta Gmail conectada por OAuth, no de la app.
  Este registro es independiente y responde a «¿lo he enviado y a quién?».

## Código

- `src/domain/history/types.ts` — `EmailSendRecord` y `HistoryInvoice.gmailLastSend`.
- `src/infrastructure/api/historyInvoiceDto.ts` + `src/infrastructure/mappers/historyInvoiceMapper.ts` — contrato y mapeo.
- `src/infrastructure/api/gmailApi.ts` — tipo de respuesta de envío.
- `src/features/shared/lib/emailSendRecord.ts` — formato de fecha y texto del envío.
- `src/features/history/pages/HistoryPage.tsx` — listado, detalle y refresco tras enviar.
- `src/features/invoices/pages/FacturarPage.tsx` — mensaje con datos reales del envío.

## Tests

- `src/infrastructure/mappers/historyInvoiceMapper.test.ts` — mapeo de `gmailLastSend` (presente/ausente).

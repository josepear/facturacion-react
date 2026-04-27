# Mapa de reutilización Fase 0

## Reutilizable casi directo
- **Cálculo:** algoritmo de `calculateTotals` trasladado a `src/domain/document/calculateTotals.ts`.
- **Documento:** contrato base de `document` consolidado en `src/domain/document/types.ts` y `src/domain/document/defaults.ts`.
- **Guardado/numeración (contrato):** consumo directo de `/api/documents`, `/api/documents/detail`, `/api/config` en `src/infrastructure/api/documentsApi.ts`.

## Reutilizable con adaptación
- **Cliente:** `/api/clients` adaptado a modelo tipado en `src/infrastructure/api/clientsApi.ts`.
- **Fiscalidad:** el cálculo actual se mantiene documento-nivel y se encapsula en dominio; futuras reglas fiscales irán en `src/domain/tax`.
- **Render/preview:** queda fuera de Fase 0, pero se reserva `src/features/shared` para encapsular componentes de salida sin HTML legado.

## No reutilizable
- **UI legacy:** `public/app.js`.
- **UI SaaS anterior:** `public/saas/saas-app.js`.
- **Plantillas HTML/CSS legacy como base:** solo sirven como referencia funcional, no como foundation del frontend nuevo.

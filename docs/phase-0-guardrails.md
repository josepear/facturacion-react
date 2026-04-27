# Guardrails de arquitectura Fase 0

## Riesgos a evitar desde el inicio
- No mezclar estado de UI y reglas de negocio en el mismo módulo.
- No duplicar cálculo de totales con variantes distintas entre frontend y backend.
- No acoplar el nuevo frontend a `querySelector`, `innerHTML` o contratos implícitos del DOM legacy.
- No introducir mejoras cosméticas antes de cerrar dominio, validación y capa API.
- No migrar pantallas completas en esta fase.

## Decisiones de contención
- Toda regla de negocio de factura vive en `src/domain`.
- Todo acceso HTTP vive en `src/infrastructure/api`.
- Formularios usan `react-hook-form` + `zod` como única vía de entrada de datos.
- `InvoiceDraftPage` es un slice técnico de validación de arquitectura, no una pantalla final.

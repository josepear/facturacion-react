# Cursor Project Rules

## Objetivo
Este proyecto busca alinear React con el comportamiento real de legacy sin inventar reglas de negocio ni cerrar falsas paridades.

## Fuente de verdad
Siempre contrastar estas dos piezas:

- Backend / legacy / proxy / contrato real:
  - `/Volumes/RAID/Repos/apps/facturacion`
- Frontend React:
  - `/Volumes/RAID/Repos/apps/facturacion/facturacion-react`

Si la duda afecta auth, permisos, `/api/config`, `/api/session`, contratos de datos, guardado o acciones de backend, no mirar solo React.

## Regla principal
Siempre enfrentar legacy y React.

No asumir que la UI React define por sí sola el comportamiento correcto.

## Roadmap
El roadmap manda.

Documento principal:
- `docs/roadmap-paridad.md`

Antes de empezar trabajo nuevo:
1. revisar el roadmap
2. elegir el siguiente bloque prioritario real
3. trabajar dentro de ese bloque

## Forma de trabajo
- Trabajar por bloques, no por microtareas.
- No abrir rama ni PR por cada bug pequeño.
- Agrupar trabajo coherente dentro del mismo módulo o bloque del roadmap.
- Integrar bugs pequeños en el bloque actual si pertenecen a él.
- Si un bug pequeño no pertenece al bloque actual y no bloquea, se apunta y se deja fuera.

## Regla de tamaño
Antes de proponer commit y PR, cerrar un bloque con un mínimo de 5 tareas reales relacionadas.

Excepciones válidas:
- bug crítico
- hotfix
- cambio delicado de arquitectura o auth
- riesgo alto de mezclar trabajo

## Commits y PRs
- No trabajar en `main`.
- Crear rama nueva desde `main` para cada bloque importante.
- No proponer commit ni PR antes de completar al menos 5 tareas relacionadas, salvo excepción justificada.
- Antes de PR:
  1. revisar el diff
  2. asegurar que no arrastra trabajo ajeno
  3. actualizar la documentación

## Documentación
Para ahorrar contexto, créditos y tokens, centralizar el estado solo en dos documentos:

- `docs/roadmap-paridad.md`
- `docs/cursor-project-rules.md`

No dispersar el estado del proyecto en más markdown salvo necesidad real.

## Regla documental
Cada 5 tareas cerradas:
1. actualizar `docs/roadmap-paridad.md`
2. reflejar qué bloque sube de nivel, qué queda pendiente y qué bugs quedan aparcados

## Reglas de producto
- No inventar ni endurecer reglas de negocio sin evidencia.
- Si hay duda real:
  1. contrastar legacy/backend
  2. si sigue dudosa, escalarla en lenguaje claro y concreto
- No vender un workaround frontend como solución completa si el problema real vive en backend.

## Contratos y permisos
Si aparece una duda de permisos, sesión o contrato:
1. revisar React
2. revisar el repo padre
3. identificar qué vive en frontend y qué vive en backend
4. proponer la solución real, no solo el síntoma visual

## Reporte esperado al final de cada bloque
- tareas realizadas
- qué parte vive en React
- qué parte vive en legacy/backend
- qué sube de nivel en el roadmap
- qué queda pendiente
- qué bug o deuda queda aparcada

## Arranque corto para ahorrar contexto
Usar este arranque por defecto:

`Lee docs/cursor-project-rules.md y docs/roadmap-paridad.md. Trabaja según esas reglas.`

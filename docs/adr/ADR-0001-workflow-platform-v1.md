# Workflow Platform — Architecture v1.0 — Frozen (ADR)

Motor genérico para ejecutar procesos guiados (tutoriales, onboarding,
checklists, asistentes) como grafos de estados dirigidos por eventos de
dominio. El primer consumidor es un tutorial, pero ningún módulo de
infraestructura debe saberlo.

Cualquier cambio en estos principios requiere una ADR nueva, no una
edición silenciosa de este documento.

## Módulos y límites

- **`lib/events`** — Bus de eventos de aplicación. Singleton, sin estado de
  UI, sin conocer React ni el DOM. Cualquier acción de negocio emite;
  cualquier sistema (workflows, analytics, auditoría, IA) escucha. No sabe
  quién lo consume.
- **`lib/workflow`** — Intérprete de grafos (`WorkflowEngine`). Ejecuta
  steps, transiciones, guards, contexto y variables. No conoce React, no
  conoce el DOM, no hace queries directas a Supabase salvo a través de
  operaciones registradas (`checkRegistry`, `seedRegistry`, etc.). No sabe
  qué es un "tutorial". Las operaciones registradas pertenecen al dominio
  de negocio, nunca al motor — el engine invoca
  `clientOperations.seedClient()`, nunca implementa
  `workflowEngine.createClient()`.
- **`lib/overlay`** — Capa visual de resaltado y mensajes contextuales.
  Sabe resaltar un selector y mostrar texto de ayuda. No conoce eventos de
  negocio, no conoce el engine, no decide cuándo avanza un proceso — solo
  reporta interacción visual (clicks) como feedback estético, nunca como
  validación.
- **`lib/targets`** — Registro de elementos interactivos de la app
  (`id` lógico → selector) y registro de páginas (`page id` → ruta). Vive
  junto a los componentes que registran sus propios targets. No conoce
  workflows ni tutoriales.
- **`workflows/<nombre>/`** — Datos, no código de infraestructura. Cada
  carpeta contiene `workflow.json` (el grafo), `metadata.json`
  (presentación: título, duración, nivel, categoría), y opcionalmente
  thumbnail, README, traducciones o tests propios del proceso.
- **`playground/`** — Entorno de desarrollo para ejecutar workflows sin
  pasar por el flujo real de usuario. Solo visible en desarrollo.

## Reglas

1. El `WorkflowEngine` nunca conoce React, el DOM, ni Supabase directamente
   — solo interactúa a través de operaciones registradas y del `EventBus`.
2. El `Overlay` nunca conoce eventos de negocio ni el `WorkflowEngine` —
   solo sabe resaltar un target y mostrar contenido.
3. El `EventBus` nunca conoce UI ni workflows — es infraestructura neutral,
   cualquier módulo puede emitir o suscribirse.
4. Los workflows describen comportamiento, nunca implementan comportamiento.
   Toda la lógica reutilizable vive en registries (`check`, `seed`, `guard`,
   `condition`, `cleanup`), nunca embebida en el JSON.
5. Ningún módulo de `lib/` contiene la palabra "tutorial" ni asume que el
   consumidor es un tutorial. Ese acoplamiento solo puede vivir dentro de
   `workflows/<nombre>/` o en el componente que monta el runner.
6. Los módulos se comunican solo por contratos públicos explícitos
   (eventos tipados, funciones registradas, props) — nunca por imports
   cruzados que asuman implementación interna de otro módulo.
7. No se añaden abstracciones (guards, variables, persistencia, ramas)
   hasta que un workflow real las necesite. El primer workflow
   (`createQuote`) es el criterio de validación del motor, no al revés.
8. **Propiedad única.** Cada responsabilidad tiene un único propietario.
   Ningún dato ni decisión debe tener dos fuentes de verdad. Si un módulo
   es propietario de una responsabilidad, el resto de módulos solo
   interactúan con él mediante su API pública.
9. **Idempotencia.** Todas las operaciones del `WorkflowEngine` deben ser
   idempotentes siempre que sea posible. Reanudar un workflow o recibir un
   evento duplicado no debe producir efectos secundarios inesperados.
10. **Compatibilidad.** El `WorkflowEngine` debe mantener compatibilidad
    con versiones anteriores del contrato (`version` en el JSON) siempre
    que sea posible. Las migraciones de formato son responsabilidad del
    engine, no de los consumidores.
11. **Observabilidad.** Todo workflow emite eventos de ciclo de vida al
    `EventBus` (`workflow.started`, `workflow.paused`, `workflow.resumed`,
    `workflow.step.entered`, `workflow.step.completed`,
    `workflow.completed`, `workflow.aborted`, `workflow.failed`). Estos
    eventos no son para consumo del propio motor — existen para que
    analytics, auditoría o IA puedan observar el proceso sin acoplarse a él.
12. **Determinismo.** Dado el mismo workflow, el mismo contexto y la misma
    secuencia de eventos, el `WorkflowEngine` debe producir siempre el
    mismo resultado. El comportamiento nunca debe depender de efectos
    implícitos ni del estado interno de otros módulos.
13. **Extensibilidad.** Todo nuevo comportamiento debe poder añadirse
    mediante registros, workflows o eventos, evitando modificar el núcleo
    (`WorkflowEngine`) salvo cuando sea estrictamente necesario.
14. **Coste en reposo (zero-cost idle).** Cuando no exista ningún workflow
    en ejecución, la plataforma no debe consumir recursos de forma
    apreciable: sin observers activos, sin listeners innecesarios, sin
    timers ni polling ni cálculos periódicos. Al ejecutar un workflow solo
    se activa lo imprescindible; al terminar (completado, abortado o
    pausado) todo lo activado se libera.

## No objetivos

La Workflow Platform v1.0 no pretende:

- Sustituir un motor BPMN ni un sistema de automatización empresarial.
- Ejecutar lógica de negocio; solo la orquesta mediante operaciones
  registradas.
- Reemplazar el sistema de navegación de la aplicación.
- Gestionar permisos o autorización de usuarios.
- Persistir automáticamente el estado de todos los workflows si un caso
  real aún no lo requiere.

## Criterios de éxito de v1.0

La arquitectura se considerará validada cuando el workflow `createQuote`
pueda:

- Ejecutarse de principio a fin.
- Pausarse y reanudarse sin inconsistencias (si esa funcionalidad ya ha
  sido implementada).
- Funcionar sobre una base de datos vacía y sobre una base de datos con
  información real.
- Reutilizar exclusivamente infraestructura genérica (`EventBus`,
  `WorkflowEngine`, `Overlay`, `Targets`) sin introducir componentes
  específicos de tutorial.

## Estado

Este documento queda congelado hasta completar el primer workflow
`createQuote`. Ningún principio será ampliado o modificado hasta haber
validado la arquitectura con una implementación funcional.

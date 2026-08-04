# Architecture Decision Records

Historial de decisiones arquitectónicas de Alivia. Cada ADR es inmutable
una vez congelado — los cambios se documentan en un ADR nuevo, no
sobrescribiendo uno existente.

- `ADR-0001` — Workflow Platform (EventBus, WorkflowEngine, Overlay,
  Targets, Workflows como datos).

## Convención

- Un archivo por decisión: `ADR-XXXX-titulo-corto.md`, numeración
  secuencial sin huecos.
- Un ADR se marca `Frozen` cuando queda cerrado como base de
  implementación.
- Reabrir un principio ya congelado requiere un ADR nuevo que lo
  reemplace o lo extienda, referenciando el anterior.

# Multitenancy mixto (BD dedicada + BD compartida por schema) — ADR

## Contexto

Hoy cada agencia tiene una fila en la tabla `agencias` (BD Admin) con sus
propias credenciales (`supabase_url`, `supabase_service_role_key_enc`, `iv`,
`auth_tag`). `src/lib/agencyDb.ts` resuelve, para cada request, la agencia del
usuario/dominio y abre un cliente Supabase distinto apuntando a la BD física
de esa agencia. El aislamiento entre agencias es total porque cada una vive
en su propio proyecto Supabase — ninguna tabla de negocio (`config_oficinas`,
`operativa_cotizaciones`, `crm_*`, etc., ~50 tablas definidas en
`database.sql`) necesita ni tiene columna `agencia_id`.

Motivación del cambio: un mayorista quiere regalar la app a varias agencias
suyas. Exigir que cada una de esas agencias tenga su propio proyecto Supabase
no es viable en ese caso — se busca poder alojar varias agencias del mismo
mayorista en una sola BD física, mientras que las agencias que sí quieren
aislamiento total (el caso de hoy) mantienen su BD dedicada. Ambos modos
deben convivir ("mixto").

## Restricción de diseño

El acceso a datos hoy usa la **service role key** (bypassa RLS). Cualquier
solución basada en `agencia_id` + RLS por fila exigiría además auditar y
mantener, en cada una de las ~50 tablas y en cada query de
`src/actions/*.ts`, un filtro manual por `agencia_id` — RLS con service role
no protege nada por sí sola. El riesgo de una fuga de datos entre agencias
del mismo mayorista por un filtro olvidado es alto y silencioso (no falla en
tests, solo se manifiesta como un dato ajeno visible en producción).

## Decisión

**Aislamiento por PostgreSQL schema, no por columna `agencia_id`.**

- Una agencia con BD dedicada sigue teniendo su propio proyecto Supabase
  (como hoy), usando el schema `public`.
- Varias agencias que comparten BD (p. ej. las agencias de un mismo
  mayorista) viven en el **mismo proyecto Supabase**, pero cada una en su
  propio schema (`agencia_<slug>`), con la misma estructura de tablas
  clonada desde `database.sql`.
- Ninguna de las ~50 tablas de negocio existentes se modifica. No se añade
  `agencia_id` a ninguna tabla. Ningún archivo de `src/actions/*.ts` cambia
  — siguen haciendo `agencyDb.from("config_oficinas")` sin saber en qué
  schema están.
- El aislamiento es estructural: una query sin filtro no puede cruzar datos
  entre agencias porque el cliente de Supabase apunta a un schema distinto
  por request. No depende de que el desarrollador recuerde un `.eq(...)`.

## Modelo de datos (BD Admin)

Se separa "dónde vive la BD" de "quién es la agencia":

```sql
-- Una fila por BD física (proyecto Supabase). Varias agencias pueden
-- apuntar a la misma conexión.
CREATE TABLE conexiones_bd (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre                      VARCHAR(255) NOT NULL,       -- ej. "Compartida Mayorista X"
    supabase_url                TEXT NOT NULL,
    supabase_service_role_key_enc TEXT NOT NULL,
    iv                          TEXT NOT NULL,
    auth_tag                    TEXT NOT NULL,
    modo                        VARCHAR(20) NOT NULL DEFAULT 'compartida', -- 'dedicada' | 'compartida'
    created_at                  TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE agencias
    ADD COLUMN conexion_bd_id UUID REFERENCES conexiones_bd(id),
    ADD COLUMN schema_name    VARCHAR(63) NOT NULL DEFAULT 'public';
```

- Agencia con BD dedicada: `conexion_bd_id` apunta a una `conexiones_bd` que
  nadie más usa, `schema_name = 'public'`. Migración trivial de las filas
  actuales: una `conexiones_bd` por cada `agencias` existente, copiando
  `supabase_url`/claves, `schema_name = 'public'`.
- Agencias del mayorista: todas comparten la misma fila de `conexiones_bd`
  (`modo = 'compartida'`), cada una con su propio `schema_name` distinto
  (`agencia_acme`, `agencia_beta`, ...).
- Las columnas `supabase_url` / `supabase_service_role_key_enc` / `iv` /
  `auth_tag` se retiran de `agencias` y quedan solo en `conexiones_bd`
  (evita duplicar/desincronizar credenciales entre agencias que comparten
  conexión).

## Cambios de código

Solo `src/lib/agencyDb.ts` cambia, en los 3 puntos donde hoy se hace
`createClient(agencia.supabase_url, serviceRoleKey, ...)`:

1. Los `select` sobre `agencias` pasan a hacer join/lookup contra
   `conexiones_bd` vía `conexion_bd_id` para obtener `supabase_url` +
   credenciales, y leen `schema_name` de `agencias`.
2. Se añade `db: { schema: agencia.schema_name } }` a las opciones de
   `createClient(...)`.

Nada más en el codebase se toca — ni `src/actions/*.ts`, ni componentes, ni
`database.sql` (que sigue siendo el script de referencia para provisionar
tablas, ahora ejecutado dentro de un schema en vez de siempre en `public`).

Adicionalmente, los 4 puntos que acceden a Storage (ver sección Storage más
abajo) pasan a derivar el nombre de bucket de `schema_name` en vez de usar
un literal fijo.

## Storage

Los buckets de Supabase Storage no tienen el concepto de schema — son
globales al proyecto. Hoy el aislamiento de storage se logra únicamente
porque cada agencia tiene su propio proyecto Supabase; los 4 puntos que usan
storage (`src/app/api/propuestas/upload-image/route.ts`,
`src/lib/propuestas/importarPdf.ts`,
`src/app/api/whatsapp/upload/route.ts`, `src/lib/documentos/storage.ts`)
usan nombres de bucket fijos (`propuestas-media`, `whatsapp-media`,
`documentos-proveedor`, `extracciones-ia`) con paths planos, sin ningún
prefijo de agencia. Si dos agencias comparten proyecto, compartirían
también esos buckets sin aislamiento.

**Decisión:** cada agencia tiene sus propios buckets, con nombre derivado de
`schema_name` (ej. `propuestas-media__agencia_acme`), incluso cuando
comparte proyecto Supabase con otras agencias. Los 4 puntos de acceso a
storage pasan a construir el nombre de bucket a partir de `schema_name` en
vez de usar el literal fijo; la lógica de auto-creación de bucket
(`createBucket` idempotente) que ya existe en 3 de los 4 sitios se reutiliza
igual, solo cambia el nombre que se crea/busca.

Regla de nombrado (evita colisión y evita migrar storage existente):

```
nombreBucket = schema_name === 'public'
  ? nombreLegado                        // ej. "propuestas-media"
  : `${nombreLegado}__${schema_name}`   // ej. "propuestas-media__agencia_acme"
```

Las agencias con BD dedicada tienen siempre `schema_name = 'public'`, así
que conservan sus buckets y paths actuales sin ningún renombrado ni
migración de objetos ni actualización de URLs guardadas en BD — es
transparente para todo lo que existe hoy. El sufijo `__{schema_name}` solo
se usa para agencias que entran al modelo de BD compartida, que empiezan
con buckets nuevos y vacíos (no hay storage previo que migrar en ese caso,
son altas nuevas).

## Aprovisionamiento de una agencia nueva

- **BD dedicada** (como hoy): crear proyecto Supabase, correr
  `database.sql` en `public`, crear fila en `conexiones_bd` + `agencias`.
- **BD compartida** (mayorista): elegir/crear la fila de `conexiones_bd` del
  mayorista, `CREATE SCHEMA agencia_<slug>;`, correr `database.sql` con
  `search_path` a ese schema, crear fila en `agencias` con
  `conexion_bd_id` + `schema_name = 'agencia_<slug>'`. Este paso es
  scriptable (mismo `database.sql`, solo cambia el schema destino).

## Alternativa descartada: `agencia_id` en cada tabla

Añadir `agencia_id` a las ~50 tablas de negocio y filtrar por fila (RLS o
manual) fue considerada y descartada:

- Requiere migrar ~50 tablas (columna, backfill, índice) y tocar cada query
  de `src/actions/*.ts` que hoy no filtra por agencia.
- Con service role key, RLS no protege — el filtrado tendría que ser manual
  y disciplinado en cada punto de acceso, para siempre. Un solo olvido
  filtra datos de una agencia a otra dentro del mismo mayorista.
- El aislamiento por schema logra el mismo resultado de negocio (BD
  compartida cuando conviene) sin ese riesgo estructural y sin tocar código
  de negocio existente.

## No objetivos

- No se elimina el modelo de BD dedicada; sigue siendo el modo por defecto
  para agencias que no forman parte de un mayorista.
- No se implementa aún límite de agencias por `conexiones_bd` compartida, ni
  automatización completa del aprovisionamiento de schema — se documenta el
  mecanismo, la herramienta de alta (script/UI) es un desarrollo posterior.

## Estado

Implementado (2026-08-18):

- `conexiones_bd` creada y `agencias.conexion_bd_id` / `agencias.schema_name`
  añadidas en la BD Admin, vía `scripts/migration_multitenancy_mixto.sql`.
- Backfill ejecutado: agencias con credenciales completas (`iv`/`auth_tag`/
  clave) migradas a su propia fila en `conexiones_bd`. 3 agencias de
  prueba (`B the travel brand`, `Halcón Viajes`, `Viajes El Corte Inglés`)
  quedaron sin `conexion_bd_id` por tener credenciales incompletas de
  origen — `agencyDb.ts` sigue resolviéndolas por las columnas legadas de
  `agencias`, sin romper su funcionamiento actual.
- `src/lib/agencyDb.ts` actualizado: los 3 puntos que crean el cliente
  Supabase resuelven credenciales vía `resolveConexion()` (usa
  `conexiones_bd` si hay `conexion_bd_id`, si no cae a las columnas legadas
  de `agencias`) y fijan `db.schema` al `schema_name` de la agencia.
- Los 4 puntos de Storage actualizados para derivar el nombre de bucket con
  `bucketNameForSchema()`.

Pendiente: dar de alta la primera agencia realmente compartida
(`modo = 'compartida'` en `conexiones_bd`, `schema_name` distinto de
`public`) para validar el flujo de extremo a extremo; automatizar el script
de aprovisionamiento de schema (`CREATE SCHEMA` + `database.sql`).

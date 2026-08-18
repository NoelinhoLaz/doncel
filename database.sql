-- ============================================================
-- SCHEMA AGENCIA DE VIAJES
-- ============================================================

-- ------------------------------------------------------------
-- EXTENSIONES
-- ------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ------------------------------------------------------------
-- CONFIG
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS config_oficinas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(255) NOT NULL,
    direccion       JSONB,
    telefono        VARCHAR(20),
    email           VARCHAR(255),
    activa          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabla para configuraciones personalizadas de los usuarios
CREATE TABLE IF NOT EXISTS config_usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id TEXT NOT NULL UNIQUE,
    oficina UUID REFERENCES config_oficinas(id) ON DELETE SET NULL,
    cuentas_bancarias JSONB DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE config_usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
CREATE POLICY "Permitir todo a usuarios autenticados" 
ON config_usuarios FOR ALL 
USING (true);

CREATE TABLE IF NOT EXISTS config_cuentas_contables (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    descripcion     VARCHAR(255) NOT NULL,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('activo', 'pasivo', 'ingreso', 'gasto', 'patrimonio')),
    naturaleza      VARCHAR(10) NOT NULL DEFAULT 'debe' CHECK (naturaleza IN ('debe', 'haber')),
    permite_apuntes BOOLEAN NOT NULL DEFAULT false,
    padre_id        UUID REFERENCES config_cuentas_contables(id),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config_cuentas_bancarias (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oficina_id          UUID NOT NULL REFERENCES config_oficinas(id),
    banco               VARCHAR(255) NOT NULL,
    iban                VARCHAR(34),
    swift               VARCHAR(11),
    descripcion         VARCHAR(255),
    cuenta_contable     VARCHAR(20),
    bridge_item_id      VARCHAR(255),
    bridge_account_id   VARCHAR(255),
    activa              BOOLEAN NOT NULL DEFAULT true,
    -- Si se incluye esta cuenta en el email automático diario (8:00) con el
    -- resultado de la conciliación OFIviaje. Marcable desde el modal
    -- "Informe de conciliación" (solo Owner).
    incluir_en_informe_automatico BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Suscripciones de notificaciones push web (PWA) por usuario/dispositivo,
-- usadas para avisar cuando se genera el informe automático de OFIviaje.
-- Tareas propuestas de conciliación OFIviaje que no se pudieron auto-conciliar
-- (proveedor distinto, importe distinto, suma, división, o sin movimiento
-- bancario encontrado). Se persisten al procesar cada fichero XML (cron o
-- comprobación manual) para no perderlas una vez el fichero se marca como
-- procesado — antes se recalculaban solo si el fichero seguía siendo "nuevo",
-- ocultándolas para siempre tras la primera pasada del cron.
CREATE TABLE IF NOT EXISTS ofiviaje_tareas_pendientes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo                VARCHAR(20) NOT NULL
                            CHECK (tipo IN ('revisarNombre', 'revisarImporte', 'revisarSuma', 'revisarDivision', 'sinMatch')),
    datos               JSONB NOT NULL,
    drive_file_id       VARCHAR(255) NOT NULL,
    drive_file_nombre   VARCHAR(500),
    resuelta            BOOLEAN NOT NULL DEFAULT false,
    resuelta_en         TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- es_cobro distingue si la tarea viene de un fichero de pagos a proveedores
-- (TSRLstVPagos_*) o de cobros de clientes (TSRLiquidacionCajas_*), para
-- poder mostrarlas agrupadas en el modal "Último informe". cuenta_bancaria_id
-- solo se puede determinar con certeza para pagos (el XML indica la cuenta
-- de tesorería); en cobros queda NULL, ya que el fichero de Liquidación de
-- Cajas no indica cuenta bancaria por fila.
ALTER TABLE ofiviaje_tareas_pendientes
ADD COLUMN IF NOT EXISTS es_cobro BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE ofiviaje_tareas_pendientes
ADD COLUMN IF NOT EXISTS cuenta_bancaria_id UUID REFERENCES config_cuentas_bancarias(id);

-- Alias proveedor OFI -> nombre bancario, para conciliar automáticamente
-- pagos donde el destinatario del cargo bancario difiere del nombre de
-- proveedor registrado en OFIviaje (ej. destinatario "IBERIA" pero proveedor
-- OFI "Aerolíneas Españolas S.A."). Se rellena automáticamente cuando el
-- usuario concilia manualmente una tarea de "Proveedor distinto", para que
-- futuros pagos del mismo proveedor con ese mismo destinatario bancario
-- concilien solos.
CREATE TABLE IF NOT EXISTS ofiviaje_alias_proveedor (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_ofi   VARCHAR(255) NOT NULL,
    alias_banco     VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (proveedor_ofi, alias_banco)
);

CREATE TABLE IF NOT EXISTS config_push_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      TEXT NOT NULL,
    endpoint        TEXT NOT NULL UNIQUE,
    p256dh          TEXT NOT NULL,
    auth            TEXT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config_tipos_servicios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    etiqueta        VARCHAR(255) NOT NULL,
    icono           VARCHAR(100) NOT NULL,
    contenido       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Catálogo de tipos de cliente por agencia (Persona, Empresa, Grupo, y los que cada
-- agencia quiera añadir desde Ajustes). Sustituye al CHECK fijo de tipo_entidad.
CREATE TABLE IF NOT EXISTS config_tipos_cliente (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    etiqueta        VARCHAR(100) NOT NULL,
    orden           INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT config_tipos_cliente_etiqueta_uniq UNIQUE (etiqueta)
);

-- ------------------------------------------------------------
-- CONTABILIDAD
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidad_entidades (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              VARCHAR(255) NOT NULL,
    razon_social        VARCHAR(255),
    documento           VARCHAR(20),
    documento_caducidad DATE,
    fecha_nacimiento    DATE,
    email               VARCHAR(255),
    telefono            VARCHAR(20),
    otros_tlfs          JSONB NULL,
    otros_emails        JSONB NULL,
    direccion           JSONB,
    lat                 NUMERIC(10, 8) NULL,
    lng                 NUMERIC(11, 8) NULL,
    roles               JSONB NOT NULL DEFAULT '{}',
    cuentas_contables   JSONB NOT NULL DEFAULT '{}',
    metadatos           JSONB NOT NULL DEFAULT '{}',
    tipo_cliente_id     UUID REFERENCES config_tipos_cliente(id) ON DELETE SET NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entidades_tipo_cliente ON contabilidad_entidades(tipo_cliente_id);

CREATE TABLE IF NOT EXISTS contabilidad_entidades_emails (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidad_id      UUID NOT NULL REFERENCES contabilidad_entidades(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    tipo            VARCHAR(50) NOT NULL DEFAULT 'general',
    es_principal    BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT contabilidad_entidades_emails_uniq UNIQUE (entidad_id, email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entidades_emails_principal ON contabilidad_entidades_emails(entidad_id) WHERE (es_principal);
CREATE INDEX IF NOT EXISTS idx_entidades_emails_entidad ON contabilidad_entidades_emails(entidad_id);
CREATE INDEX IF NOT EXISTS idx_entidades_emails_email ON contabilidad_entidades_emails(email);

CREATE INDEX IF NOT EXISTS idx_entidades_documento        ON contabilidad_entidades(documento);
CREATE INDEX IF NOT EXISTS idx_entidades_roles            ON contabilidad_entidades USING gin(roles);
CREATE INDEX IF NOT EXISTS idx_entidades_metadatos        ON contabilidad_entidades USING gin(metadatos);

-- Trigger: genera palabras_match automáticamente al insertar o cambiar nombre
CREATE OR REPLACE FUNCTION trigger_entidad_metadatos()
RETURNS TRIGGER AS $$
DECLARE
    palabras            TEXT[];
    palabras_filtradas  TEXT[];
BEGIN
    -- Solo regenera si es INSERT o si el nombre cambió
    IF TG_OP = 'INSERT' OR OLD.nombre IS DISTINCT FROM NEW.nombre THEN

        -- Normalizar: minúsculas + sin tildes + colapsar espacios
        palabras := string_to_array(
            regexp_replace(
                lower(unaccent(NEW.nombre)),
                '\s+', ' ', 'g'
            ),
            ' '
        );

        -- Filtrar partículas y palabras de longitud 1
        SELECT array_agg(p)
        INTO palabras_filtradas
        FROM unnest(palabras) p
        WHERE p NOT IN ('de', 'del', 'la', 'los', 'las', 'el', 'y', 'e', 'sl', 'sa', 's.l', 's.a')
        AND length(p) > 1;

        -- Sobreescribe palabras_match pero respeta el resto del JSON
        NEW.metadatos := jsonb_set(
            COALESCE(NEW.metadatos, '{}'),
            '{palabras_match}',
            to_jsonb(palabras_filtradas)
        );

    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_entidad_metadatos'
    ) THEN
        EXECUTE 'CREATE TRIGGER tr_entidad_metadatos
        BEFORE INSERT OR UPDATE
        ON contabilidad_entidades
        FOR EACH ROW
        EXECUTE FUNCTION trigger_entidad_metadatos()';
    END IF;
END
$$;

-- Función: búsqueda de entidades insensible a mayúsculas/minúsculas y tildes
CREATE OR REPLACE FUNCTION buscar_entidades(q TEXT, max_rows INT DEFAULT 8)
RETURNS SETOF contabilidad_entidades
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM contabilidad_entidades
  WHERE unaccent(lower(nombre)) LIKE '%' || unaccent(lower(q)) || '%'
  ORDER BY nombre ASC
  LIMIT max_rows;
$$;

GRANT EXECUTE ON FUNCTION buscar_entidades(TEXT, INT) TO service_role;

-- Trigger: Autogenerar cuentas contables (cliente y anticipo) para entidades con rol cliente
CREATE OR REPLACE FUNCTION fn_autogenerar_cuentas_cliente()
RETURNS TRIGGER AS $$
DECLARE
    v_siguiente_num INTEGER;
    v_siguiente_cta VARCHAR(11);
    v_siguiente_ant VARCHAR(11);
BEGIN
    -- Solo procesamos si la entidad tiene asignado el rol 'cliente'
    IF NEW.roles @> '{"cliente": true}' THEN
        
        -- Comprobar si ya tiene cuentas contables asignadas de cliente
        IF NEW.cuentas_contables IS NULL 
           OR NOT (NEW.cuentas_contables ? 'cliente') 
           OR NEW.cuentas_contables->>'cliente' IS NULL 
           OR NEW.cuentas_contables->>'cliente' = '' THEN
            
            -- 1. Buscar la última cuenta cliente numérica asignada que empiece por 430
            SELECT COALESCE(
                MAX(SUBSTRING(cuentas_contables->>'cliente' FROM 7)::INTEGER),
                9999 -- Comenzará en 10000 al sumarle 1
            )
            INTO v_siguiente_num
            FROM contabilidad_entidades
            WHERE roles @> '{"cliente": true}'
              AND cuentas_contables->>'cliente' ~ '^430\d{8}$';
            
            -- 2. Incrementar la secuencia
            v_siguiente_num := v_siguiente_num + 1;
            
            -- 3. Formatear la subcuenta (ej. 43000010000, 43000010001)
            v_siguiente_cta := '430000' || v_siguiente_num::TEXT;
            v_siguiente_ant := '438000' || v_siguiente_num::TEXT;
            
            -- 4. Inyectar las cuentas de forma segura en el JSONB
            NEW.cuentas_contables := COALESCE(NEW.cuentas_contables, '{}'::jsonb) 
                || jsonb_build_object(
                    'cliente', v_siguiente_cta,
                    'cuenta_cliente', v_siguiente_cta,
                    'anticipo', v_siguiente_ant,
                    'cuenta_anticipo', v_siguiente_ant
                );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_autogenerar_cuentas_cliente'
    ) THEN
        CREATE TRIGGER tr_autogenerar_cuentas_cliente
        BEFORE INSERT OR UPDATE ON contabilidad_entidades
        FOR EACH ROW
        EXECUTE FUNCTION fn_autogenerar_cuentas_cliente();
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS contabilidad_movimientos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidad_id          UUID NOT NULL REFERENCES contabilidad_entidades(id),
    usuario_id          TEXT NOT NULL,
    tipo                VARCHAR(20) NOT NULL CHECK (tipo IN ('cobro', 'pago', 'reembolso_cobro', 'reembolso_pago')),
    importe_total       DECIMAL(12,2) NOT NULL,
    moneda              VARCHAR(3) NOT NULL DEFAULT 'EUR',
    medio_pago          VARCHAR(20) NOT NULL CHECK (medio_pago IN ('banco', 'efectivo', 'tarjeta', 'online')),
    tipo_servicio       VARCHAR(50),
    fecha               DATE NOT NULL,
    concepto            VARCHAR(500),
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'anulado')),
    movimiento_banco_id UUID,
    expediente_id       UUID,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_entidad        ON contabilidad_movimientos(entidad_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha          ON contabilidad_movimientos(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo           ON contabilidad_movimientos(tipo);

-- Sobrante de un pago a proveedor que no se pudo aplicar a ningún servicio porque los
-- seleccionados ya quedaron cubiertos al 100% (ej. redondeos/diferencias del banco).
-- Queda disponible para aplicarse como crédito en el siguiente pago al mismo proveedor.
ALTER TABLE contabilidad_movimientos
ADD COLUMN IF NOT EXISTS sobrante DECIMAL(12,2) NOT NULL DEFAULT 0.00;

ALTER TABLE contabilidad_movimientos
ADD COLUMN IF NOT EXISTS sobrante_aplicado BOOLEAN NOT NULL DEFAULT false;

-- Visto bueno de Dirección Comercial sobre una conciliación manual. Solo el
-- Owner puede marcarlo y solo el Owner puede ver los movimientos así
-- marcados; para el resto de usuarios quedan ocultos del histórico.
ALTER TABLE contabilidad_movimientos
ADD COLUMN IF NOT EXISTS vobo_dc BOOLEAN NOT NULL DEFAULT false;

-- Nota libre opcional al conciliar manualmente, visible en el histórico de
-- conciliaciones (tooltip "Manual").
ALTER TABLE contabilidad_movimientos
ADD COLUMN IF NOT EXISTS nota VARCHAR(500);

-- Gasto Financiero: marcado manualmente desde el modal de conciliación
ALTER TABLE contabilidad_movimientos
ADD COLUMN IF NOT EXISTS es_gasto_financiero BOOLEAN NOT NULL DEFAULT false;

-- entidad_id pasa a ser opcional: los pagos a proveedor (proveedor_id) ya no necesitan una
-- entidad de contabilidad ficticia solo para satisfacer una restricción NOT NULL. entidad_id
-- se sigue usando tal cual para cobros/imputaciones a clientes-viajeros (donde sí es la fuente
-- de verdad), pero deja de ser obligatorio para permitir pagos a proveedor sin entidad.
ALTER TABLE contabilidad_movimientos
ALTER COLUMN entidad_id DROP NOT NULL;

-- Soporte para pagos "pendientes de conciliar": se registra el pago (cuenta como abonado del
-- servicio) antes de que el movimiento bancario real esté descargado en el sistema. fecha_registro
-- es siempre el día en que se creó el registro; fecha es la fecha real del pago, que queda NULL
-- hasta que se vincule un movimiento bancario real (momento en que se copia su fecha_operacion).
ALTER TABLE contabilidad_movimientos
ADD COLUMN IF NOT EXISTS fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE contabilidad_movimientos
ALTER COLUMN fecha DROP NOT NULL;

ALTER TABLE contabilidad_movimientos
DROP CONSTRAINT IF EXISTS contabilidad_movimientos_estado_check;

ALTER TABLE contabilidad_movimientos
ADD CONSTRAINT contabilidad_movimientos_estado_check
CHECK (estado IN ('pendiente', 'confirmado', 'anulado', 'pendiente_conciliar'));

CREATE TABLE IF NOT EXISTS contabilidad_movimientos_imputaciones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movimiento_id   UUID NOT NULL REFERENCES contabilidad_movimientos(id),
    expediente_id   UUID NOT NULL,
    viajero_id      UUID NOT NULL REFERENCES contabilidad_entidades(id),
    importe         DECIMAL(12,2) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (movimiento_id, expediente_id, viajero_id)
);

CREATE INDEX IF NOT EXISTS idx_imputaciones_movimiento    ON contabilidad_movimientos_imputaciones(movimiento_id);
CREATE INDEX IF NOT EXISTS idx_imputaciones_expediente    ON contabilidad_movimientos_imputaciones(expediente_id);
CREATE INDEX IF NOT EXISTS idx_imputaciones_viajero       ON contabilidad_movimientos_imputaciones(viajero_id);

CREATE TABLE IF NOT EXISTS contabilidad_movimientos_banco (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_bancaria_id  UUID NOT NULL REFERENCES config_cuentas_bancarias(id),

    -- Campos comunes N43 y Bridge
    fecha_operacion     DATE NOT NULL,
    fecha_valor         DATE,
    importe             DECIMAL(12,2) NOT NULL,
    concepto_limpio     VARCHAR(500),
    moneda              VARCHAR(3) NOT NULL DEFAULT 'EUR',
    origen              VARCHAR(10) NOT NULL CHECK (origen IN ('bridge', 'n43')),

    -- Bridge
    bridge_id           BIGINT,
    bridge_account_id   BIGINT,
    concepto_original   VARCHAR(500),
    fecha_transaccion   DATE,
    fecha_contable      DATE,
    operation_type      VARCHAR(50),
    category_id         INTEGER,
    future              BOOLEAN,
    bridge_raw          JSONB,

    -- N43
    referencia1         VARCHAR(255),
    referencia2         VARCHAR(255),
    codigo_operacion    VARCHAR(10),
    fichero_origen      VARCHAR(255),

    -- Match
    metadatos           JSONB,
    match_score         DECIMAL(4,2),
    match_propuesto_at  TIMESTAMP,
    match_metadatos     JSONB,

    -- Conciliación
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'propuesto', 'conciliado', 'descartado', 'futuro')),
    conciliacion_tipo   VARCHAR(20) CHECK (conciliacion_tipo IN ('automatica', 'manual')),
    conciliado_at       TIMESTAMP,
    conciliado_por      TEXT,

    -- Conciliación externa (ej. OFIviaje vía XML en Drive) — independiente de la
    -- conciliación interna de arriba. Ambas pueden coexistir cuando estado = 'parcial'.
    conciliado_externo         BOOLEAN NOT NULL DEFAULT false,
    conciliado_externo_origen  VARCHAR(30),
    conciliado_externo_en      TIMESTAMP,
    conciliado_externo_datos   JSONB,

    -- Gasto Financiero: marcado manualmente desde el modal de conciliación
    es_gasto_financiero BOOLEAN NOT NULL DEFAULT false,

    deleted             BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- UNIQUE constraint real (no índice parcial) para poder usar ON CONFLICT (bridge_id)
-- en el upsert de movimientos Bridge. Postgres permite múltiples NULL en una
-- UNIQUE constraint normal, así que los movimientos N43 (sin bridge_id) no se ven afectados.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'idx_banco_bridge_id'
    ) THEN
        ALTER TABLE contabilidad_movimientos_banco ADD CONSTRAINT idx_banco_bridge_id UNIQUE (bridge_id);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_banco_estado               ON contabilidad_movimientos_banco(estado);
CREATE INDEX IF NOT EXISTS idx_banco_fecha                ON contabilidad_movimientos_banco(fecha_operacion);
CREATE INDEX IF NOT EXISTS idx_banco_metadatos            ON contabilidad_movimientos_banco USING gin(metadatos);
CREATE INDEX IF NOT EXISTS idx_banco_conciliado_externo   ON contabilidad_movimientos_banco(conciliado_externo) WHERE conciliado_externo = true;

-- Ficheros XML de OFIviaje (en la carpeta de Drive del usuario) ya comprobados,
-- para no reprocesarlos en cada polling/comprobación manual.
CREATE TABLE IF NOT EXISTS ofiviaje_ficheros_procesados (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_file_id            VARCHAR(255) NOT NULL,
    drive_modified_time      TIMESTAMP NOT NULL,
    nombre_fichero           VARCHAR(500),
    pagos_procesados         INTEGER NOT NULL DEFAULT 0,
    movimientos_conciliados  INTEGER NOT NULL DEFAULT 0,
    procesado_en             TIMESTAMP NOT NULL DEFAULT NOW(),
    origen                   VARCHAR(20) NOT NULL DEFAULT 'manual',
    UNIQUE (drive_file_id, drive_modified_time)
);

CREATE INDEX IF NOT EXISTS idx_ofiviaje_ficheros_drive_id ON ofiviaje_ficheros_procesados(drive_file_id);

-- Trigger: genera pool1 y pool2 automáticamente al importar movimiento bancario
CREATE OR REPLACE FUNCTION trigger_banco_metadatos()
RETURNS TRIGGER AS $$
DECLARE
    concepto_norm   TEXT;
    after_de        TEXT;
    before_concepto TEXT;
    after_concepto  TEXT;
    pool1           TEXT[];
    pool2           TEXT[];
BEGIN
    IF NEW.concepto_original IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.concepto_original IS NOT DISTINCT FROM NEW.concepto_original THEN
        RETURN NEW;
    END IF;

    concepto_norm := lower(unaccent(NEW.concepto_original));

    IF concepto_norm ~ 'transferencia (inmediata )?de .+ concepto .+' THEN

        after_de := regexp_replace(concepto_norm, '^.*transferencia (inmediata )?de ', '');
        before_concepto := split_part(after_de, ' concepto ', 1);
        after_concepto  := split_part(after_de, ' concepto ', 2);

        -- Pool1: emisor — separar por espacios y comas (nombres propios)
        SELECT array_agg(DISTINCT p)
        INTO pool1
        FROM unnest(regexp_split_to_array(trim(before_concepto), '[\s,]+')) p
        WHERE length(p) > 1;

        -- Pool2: concepto libre — separar por espacios Y guiones
        -- "aventura-pirineo-s" → ["aventura", "pirineo", "s"]
        SELECT array_agg(DISTINCT p)
        INTO pool2
        FROM unnest(regexp_split_to_array(trim(after_concepto), '[\s\-]+')) p
        WHERE length(p) > 1;

    ELSIF concepto_norm ~ 'transferencia (inmediata )?de .+' THEN

        after_de := regexp_replace(concepto_norm, '^.*transferencia (inmediata )?de ', '');

        SELECT array_agg(DISTINCT p)
        INTO pool1
        FROM unnest(regexp_split_to_array(trim(after_de), '[\s,]+')) p
        WHERE length(p) > 1;

        pool2 := ARRAY[]::TEXT[];

    END IF;

    IF pool1 IS NOT NULL THEN
        NEW.metadatos := jsonb_set(
            COALESCE(NEW.metadatos, '{}'),
            '{pool1}',
            to_jsonb(pool1)
        );
    END IF;

    IF pool2 IS NOT NULL THEN
        NEW.metadatos := jsonb_set(
            COALESCE(NEW.metadatos, '{}'),
            '{pool2}',
            to_jsonb(pool2)
        );
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para regenerar pool1/pool2 en movimientos ya importados
-- (el trigger solo dispara en INSERT o si cambia concepto_original)
CREATE OR REPLACE FUNCTION fn_regenerar_pools_banco()
RETURNS jsonb AS $$
DECLARE
    r               RECORD;
    concepto_norm   TEXT;
    after_de        TEXT;
    before_concepto TEXT;
    after_concepto  TEXT;
    pool1           TEXT[];
    pool2           TEXT[];
    actualizados    INT := 0;
BEGIN
    FOR r IN
        SELECT id, concepto_original
        FROM contabilidad_movimientos_banco
        WHERE concepto_original IS NOT NULL
          AND deleted = false
    LOOP
        concepto_norm := lower(unaccent(r.concepto_original));
        pool1 := NULL;
        pool2 := NULL;

        IF concepto_norm ~ 'transferencia (inmediata )?de .+ concepto .+' THEN
            after_de        := regexp_replace(concepto_norm, '^.*transferencia (inmediata )?de ', '');
            before_concepto := split_part(after_de, ' concepto ', 1);
            after_concepto  := split_part(after_de, ' concepto ', 2);

            SELECT array_agg(DISTINCT p) INTO pool1
            FROM unnest(regexp_split_to_array(trim(before_concepto), '[\s,]+')) p
            WHERE length(p) > 1;

            SELECT array_agg(DISTINCT p) INTO pool2
            FROM unnest(regexp_split_to_array(trim(after_concepto), '[\s\-]+')) p
            WHERE length(p) > 1;

        ELSIF concepto_norm ~ 'transferencia (inmediata )?de .+' THEN
            after_de := regexp_replace(concepto_norm, '^.*transferencia (inmediata )?de ', '');

            SELECT array_agg(DISTINCT p) INTO pool1
            FROM unnest(regexp_split_to_array(trim(after_de), '[\s,]+')) p
            WHERE length(p) > 1;

            pool2 := ARRAY[]::TEXT[];
        END IF;

        IF pool1 IS NOT NULL OR pool2 IS NOT NULL THEN
            UPDATE contabilidad_movimientos_banco
            SET metadatos = jsonb_set(
                                jsonb_set(
                                    COALESCE(metadatos, '{}'),
                                    '{pool1}',
                                    COALESCE(to_jsonb(pool1), '[]'::jsonb)
                                ),
                                '{pool2}',
                                COALESCE(to_jsonb(pool2), '[]'::jsonb)
                            ),
                updated_at = NOW()
            WHERE id = r.id;

            actualizados := actualizados + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('actualizados', actualizados);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_banco_metadatos'
    ) THEN
        EXECUTE 'CREATE TRIGGER tr_banco_metadatos
        BEFORE INSERT OR UPDATE
        ON contabilidad_movimientos_banco
        FOR EACH ROW
        EXECUTE FUNCTION trigger_banco_metadatos()';
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS contabilidad_ejercicios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ejercicio       INTEGER NOT NULL UNIQUE,
    nombre          VARCHAR(255) NOT NULL,
    fecha_inicio    DATE NOT NULL,
    fecha_fin       DATE NOT NULL,
    estado          VARCHAR(20) NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado', 'bloqueado')),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ejercicios_ejercicio ON contabilidad_ejercicios(ejercicio);

CREATE TABLE IF NOT EXISTS contabilidad_asientos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero          VARCHAR(20) NOT NULL UNIQUE,
    fecha           DATE NOT NULL,
    concepto        VARCHAR(500),
    ejercicio       INTEGER NOT NULL REFERENCES contabilidad_ejercicios(ejercicio),
    movimiento_id   UUID REFERENCES contabilidad_movimientos(id),
    usuario_id      TEXT NOT NULL,
    estado          VARCHAR(20) NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'contabilizado', 'anulado')),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asientos_fecha             ON contabilidad_asientos(fecha);
CREATE INDEX IF NOT EXISTS idx_asientos_ejercicio         ON contabilidad_asientos(ejercicio);
CREATE INDEX IF NOT EXISTS idx_asientos_movimiento        ON contabilidad_asientos(movimiento_id);

CREATE TABLE IF NOT EXISTS contabilidad_apuntes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asiento_id      UUID REFERENCES contabilidad_asientos(id),
    cuenta_id       UUID NOT NULL REFERENCES config_cuentas_contables(id),
    entidad_id      UUID REFERENCES contabilidad_entidades(id),
    subcuenta       VARCHAR(20),
    fecha           DATE NOT NULL,
    debe            DECIMAL(12,2) NOT NULL DEFAULT 0,
    haber           DECIMAL(12,2) NOT NULL DEFAULT 0,
    concepto        VARCHAR(500),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apuntes_asiento            ON contabilidad_apuntes(asiento_id);
CREATE INDEX IF NOT EXISTS idx_apuntes_cuenta             ON contabilidad_apuntes(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_apuntes_entidad            ON contabilidad_apuntes(entidad_id);

-- ------------------------------------------------------------
-- PROVEEDORES (CONTABILIDAD)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contabilidad_proveedores (
  id text not null,
  nombre text null,
  tipo text null,
  observaciones text null,
  creado_en timestamp with time zone null,
  catalogo uuid null,
  cuenta_contable text null,
  razon_social text null,
  direccion text null,
  "CIF" text null,
  codigo_postal text null,
  localidad text null,
  telefono text null,
  fax text null,
  comunidad text null,
  pais text null,
  nombre_contacto text null,
  cargo text null,
  email text null,
  licencia text null,
  constraint contabilidad_proveedores_pkey primary key (id)
  -- constraint proveedores_catalogo_fkey foreign KEY (catalogo) references proveedor_catalogo (id)
);

-- Aliases del proveedor: nombres exactos que aparecen en operativa_expedientes_servicios.proveedor
ALTER TABLE public.contabilidad_proveedores ADD COLUMN IF NOT EXISTS alias TEXT[] DEFAULT '{}';

-- Vínculo explícito a la entidad de contabilidad (contabilidad_entidades) que representa a
-- este proveedor en movimientos/pagos. contabilidad_proveedores y contabilidad_entidades son
-- catálogos independientes (sin relación por nombre fiable), y contabilidad_movimientos.entidad_id
-- es NOT NULL, así que sin este vínculo los pagos a proveedores sin entidad creada terminaban
-- cayendo en un fallback que asignaba una entidad arbitraria (bug detectado: varios pagos de
-- proveedores distintos quedaron todos atribuidos a la misma entidad por error).
ALTER TABLE public.contabilidad_proveedores ADD COLUMN IF NOT EXISTS entidad_id UUID REFERENCES contabilidad_entidades(id) ON DELETE SET NULL;

-- Referencia directa al proveedor real (contabilidad_proveedores) de un pago, sin pasar por
-- contabilidad_entidades (catálogo independiente, sin relación fiable por nombre).
ALTER TABLE contabilidad_movimientos
ADD COLUMN IF NOT EXISTS proveedor_id TEXT REFERENCES contabilidad_proveedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_proveedor ON contabilidad_movimientos(proveedor_id);

-- ------------------------------------------------------------
-- OPERATIVA
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.maestro_destinos (
  id uuid not null default gen_random_uuid (),
  nombre text not null,
  nombre_comercial text null,
  google_place_id text null,
  osm_id text null,
  osm_type text null,
  agency_id uuid null,
  tipo_destino text null default 'CIUDAD'::text,
  continente text null,
  country text null,
  admin_area_l1 text null,
  admin_area_l2 text null,
  locality text null,
  route text null,
  postal_code text null,
  formatted_address text null,
  viewport jsonb null default null,
  google_maps_uri text null,
  utc_offset_minutes integer null,
  lat numeric(10, 8) null,
  lng numeric(11, 8) null,
  parent_id uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  google_metadata jsonb null default '{}'::jsonb,
  admin_area_l1_norm text null,
  admin_area_l2_norm text null,
  constraint maestro_destinos_pkey primary key (id),
  constraint maestro_destinos_parent_id_fkey foreign KEY (parent_id) references maestro_destinos (id) on delete set null
) TABLESPACE pg_default;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_maestro_destinos_nombre on public.maestro_destinos using gin (nombre_comercial gin_trgm_ops) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_maestro_destinos_country on public.maestro_destinos using btree (country) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_maestro_destinos_locality on public.maestro_destinos using btree (locality) TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_maestro_destinos_place_agency on public.maestro_destinos using btree (google_place_id, agency_id) TABLESPACE pg_default
where
  (google_place_id is not null);

CREATE UNIQUE INDEX IF NOT EXISTS idx_maestro_destinos_osm_agency on public.maestro_destinos using btree (osm_type, osm_id, agency_id) TABLESPACE pg_default
where
  (osm_id is not null);

CREATE OR REPLACE FUNCTION fn_normalizar_nombres_destinos()
RETURNS TRIGGER AS $$
BEGIN
    NEW.admin_area_l1_norm := NULLIF(trim(regexp_replace(lower(unaccent(NEW.admin_area_l1)), '\s+', ' ', 'g')), '');
    NEW.admin_area_l2_norm := NULLIF(trim(regexp_replace(lower(unaccent(NEW.admin_area_l2)), '\s+', ' ', 'g')), '');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_normalizar_destinos BEFORE INSERT
or
update on maestro_destinos for EACH row
execute FUNCTION fn_normalizar_nombres_destinos ();

CREATE TABLE IF NOT EXISTS operativa_expedientes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero          VARCHAR(50) UNIQUE,
    referencia      VARCHAR(150) NOT NULL,
    oficina_id      UUID NOT NULL REFERENCES config_oficinas(id),
    destino_principal UUID REFERENCES public.maestro_destinos(id),
    entidad_id      UUID REFERENCES public.contabilidad_entidades(id) ON DELETE SET NULL,
    agente_id       TEXT NOT NULL,
    fecha_inicio    DATE,
    fecha_fin       DATE,
    estado          VARCHAR(20) NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'confirmado', 'anulado', 'cerrado')),
    tipo_expediente         VARCHAR(20) NOT NULL DEFAULT 'vacacional' CHECK (tipo_expediente IN ('grupo', 'vacacional', 'p2p')),
    forma_pago              VARCHAR(20) NOT NULL DEFAULT 'un_pagador' CHECK (forma_pago IN ('un_pagador', 'varios_pagadores')),
    formas_pago_aceptadas   JSONB NOT NULL DEFAULT '[]',
    plazos                  JSONB NOT NULL DEFAULT '[]',
    genera_apunte           BOOLEAN NOT NULL DEFAULT false,
    apuntes_desde           DATE,
    metadata        JSONB,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE operativa_expedientes ADD COLUMN IF NOT EXISTS pvp_viajero DECIMAL(12,2);
ALTER TABLE operativa_expedientes ADD COLUMN IF NOT EXISTS pvp_total DECIMAL(12,2);
ALTER TABLE operativa_expedientes ADD COLUMN IF NOT EXISTS apuntes_desde DATE;
ALTER TABLE operativa_expedientes ADD COLUMN IF NOT EXISTS servicios_opcionales JSONB DEFAULT '[]'::jsonb;
ALTER TABLE operativa_expedientes ADD COLUMN IF NOT EXISTS slug VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_expedientes_referencia     ON operativa_expedientes(referencia);
CREATE INDEX IF NOT EXISTS idx_expedientes_estado         ON operativa_expedientes(estado);
CREATE INDEX IF NOT EXISTS idx_expedientes_oficina        ON operativa_expedientes(oficina_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_entidad_contacto  ON operativa_expedientes(entidad_id);

CREATE TABLE IF NOT EXISTS operativa_viajeros_expedientes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id       UUID NOT NULL REFERENCES operativa_expedientes(id),
    entidad_id          UUID NOT NULL REFERENCES contabilidad_entidades(id),
    rol_en_expediente   VARCHAR(50) NOT NULL DEFAULT 'viajero',
    datos_viaje         JSONB,
    extras              JSONB,
    importe_extras      DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado              VARCHAR(20) NOT NULL DEFAULT 'confirmado' CHECK (estado IN ('pendiente', 'confirmado', 'anulado')),
    fecha_anulacion     DATE,
    motivo_anulacion    VARCHAR(500),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (expediente_id, entidad_id)
);

ALTER TABLE operativa_viajeros_expedientes ADD COLUMN IF NOT EXISTS alergias JSONB DEFAULT '[]'::jsonb;
ALTER TABLE operativa_viajeros_expedientes ADD COLUMN IF NOT EXISTS pagador_id UUID REFERENCES contabilidad_entidades(id) ON DELETE SET NULL;
ALTER TABLE operativa_viajeros_expedientes ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES contabilidad_entidades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_viajeros_exp_expediente    ON operativa_viajeros_expedientes(expediente_id);
CREATE INDEX IF NOT EXISTS idx_viajeros_exp_entidad       ON operativa_viajeros_expedientes(entidad_id);
CREATE INDEX IF NOT EXISTS idx_viajeros_exp_pagador       ON operativa_viajeros_expedientes(pagador_id);
CREATE INDEX IF NOT EXISTS idx_viajeros_exp_tutor         ON operativa_viajeros_expedientes(tutor_id);

CREATE TABLE IF NOT EXISTS operativa_pagadores_expedientes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id       UUID NOT NULL REFERENCES operativa_expedientes(id),
    entidad_id          UUID NOT NULL REFERENCES contabilidad_entidades(id),
    importe_total       DECIMAL(12,2) NOT NULL,
    importe_abonado     DECIMAL(12,2) NOT NULL DEFAULT 0,
    cuenta_bancaria     VARCHAR(34),
    plazos              JSONB,
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'parcial', 'completado')),
    metadatos_match     JSONB,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (expediente_id, entidad_id)
);

CREATE INDEX IF NOT EXISTS idx_pagadores_expediente       ON operativa_pagadores_expedientes(expediente_id);
CREATE INDEX IF NOT EXISTS idx_pagadores_entidad          ON operativa_pagadores_expedientes(entidad_id);
CREATE INDEX IF NOT EXISTS idx_pagadores_estado           ON operativa_pagadores_expedientes(estado);
CREATE INDEX IF NOT EXISTS idx_pagadores_metadatos        ON operativa_pagadores_expedientes USING gin(metadatos_match);


CREATE TABLE IF NOT EXISTS operativa_expedientes_servicios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id   UUID NOT NULL REFERENCES operativa_expedientes(id) ON DELETE CASCADE,
    tipo            UUID REFERENCES config_tipos_servicios(id) ON DELETE SET NULL,
    proveedor       VARCHAR(255) NULL,
    descripcion     TEXT NOT NULL,
    neto            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    pvp             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    plazas          INTEGER NOT NULL DEFAULT 1,
    total           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    minimo_plazas   INTEGER,
    condiciones     JSONB NOT NULL DEFAULT '[]',
    opcional        BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expedientes_servicios_expediente ON operativa_expedientes_servicios(expediente_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_servicios_opcional   ON operativa_expedientes_servicios(opcional);
CREATE INDEX IF NOT EXISTS idx_expedientes_servicios_tipo       ON operativa_expedientes_servicios(tipo);

-- Agregar columnas para guardar plazas y total en servicios existentes
ALTER TABLE operativa_expedientes_servicios
    ADD COLUMN IF NOT EXISTS plazas INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- FK a proveedor en servicios para match directo por UUID
ALTER TABLE public.operativa_expedientes_servicios
ADD COLUMN IF NOT EXISTS proveedor_id TEXT REFERENCES contabilidad_proveedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expedientes_servicios_proveedor ON public.operativa_expedientes_servicios(proveedor_id);

-- ------------------------------------------------------------
-- VINCULACIÓN DE VIAJEROS A SERVICIOS (OPCIONALES / EXTRAS)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.operativa_viajero_servicios (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  viajero_id UUID NOT NULL,      -- ID del alumno / viajero (apunta a contabilidad_entidades o operativa_viajeros_expedientes)
  servicio_id UUID NOT NULL,     -- ID del servicio (apunta a operativa_expedientes_servicios)
  pagado BOOLEAN NOT NULL DEFAULT FALSE, -- Para controlar el estado del cobro del extra
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT operativa_viajero_servicios_pkey PRIMARY KEY (id),
  
  -- 🛡️ INTEGRIDAD: Si se borra un servicio, se limpian sus vinculaciones automáticamente
  CONSTRAINT fk_operativa_servicio FOREIGN KEY (servicio_id) 
    REFERENCES public.operativa_expedientes_servicios(id) ON DELETE CASCADE
);

-- 🚀 ÍNDICES DE VELOCIDAD ELITE (Para que tus gráficas de Groomy carguen en milisegundos)
CREATE INDEX IF NOT EXISTS idx_operativa_viajero_servicios_viajero 
  ON public.operativa_viajero_servicios(viajero_id);

CREATE INDEX IF NOT EXISTS idx_operativa_viajero_servicios_servicio 
  ON public.operativa_viajero_servicios(servicio_id);


-- ============================================================
-- HELPERS DE EMAIL
-- ============================================================

CREATE OR REPLACE VIEW vista_entidad_emails AS
SELECT
    ee.email,
    ee.tipo,
    ee.es_principal,
    e.id AS entidad_id,
    e.nombre AS entidad_nombre,
    e.documento,
    e.telefono,
    e.direccion,
    e.created_at AS entidad_created_at
FROM contabilidad_entidades_emails ee
JOIN contabilidad_entidades e ON e.id = ee.entidad_id;

CREATE OR REPLACE FUNCTION fn_expedientes_por_email(p_email TEXT)
RETURNS TABLE(
    email TEXT,
    entidad_id UUID,
    entidad_nombre TEXT,
    relacion TEXT,
    expediente_id UUID,
    expediente_referencia VARCHAR,
    expediente_estado VARCHAR
) AS $$
SELECT
    ee.email,
    e.id,
    e.nombre,
    'pagador' AS relacion,
    exp.id,
    exp.referencia,
    exp.estado
FROM contabilidad_entidades_emails ee
JOIN contabilidad_entidades e ON e.id = ee.entidad_id
JOIN operativa_pagadores_expedientes pay ON pay.entidad_id = e.id
JOIN operativa_expedientes exp ON exp.id = pay.expediente_id
WHERE ee.email = p_email
UNION ALL
SELECT
    ee.email,
    e.id,
    e.nombre,
    'viajero' AS relacion,
    exp.id,
    exp.referencia,
    exp.estado
FROM contabilidad_entidades_emails ee
JOIN contabilidad_entidades e ON e.id = ee.entidad_id
JOIN operativa_viajeros_expedientes v ON v.entidad_id = e.id
JOIN operativa_expedientes exp ON exp.id = v.expediente_id
WHERE ee.email = p_email;
$$ LANGUAGE sql STABLE;
-- ------------------------------------------------------------
-- FK DIFERIDAS
-- ------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_imputaciones_expediente'
    ) THEN
        ALTER TABLE contabilidad_movimientos_imputaciones
            ADD CONSTRAINT fk_imputaciones_expediente
            FOREIGN KEY (expediente_id) REFERENCES operativa_expedientes(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_movimientos_banco'
    ) THEN
        ALTER TABLE contabilidad_movimientos
            ADD CONSTRAINT fk_movimientos_banco
            FOREIGN KEY (movimiento_banco_id) REFERENCES contabilidad_movimientos_banco(id);
    END IF;
END
$$;



-- ============================================================
-- DATOS INICIALES: CUENTAS CONTABLES
-- ============================================================

INSERT INTO config_cuentas_contables (id, codigo, descripcion, tipo, naturaleza, permite_apuntes, padre_id, created_at) VALUES
('03e3d49c-e3c7-44cc-b8df-25ca1ca78cf5', '572',  'Bancos c/c',                                        'activo',     'debe',  true, NULL, '2026-03-11 11:06:19.903713+00'),
('1b820893-0fc2-409f-bccc-576c6c374619', '407',  'Anticipos a proveedores',                           'activo',     'debe',  true, NULL, '2026-03-11 11:06:19.903713+00'),
('2d3440c0-33d9-4e38-8bf7-bfdbfb7a7c2f', '700', 'Ventas de mercaderías',                             'ingreso',    'haber', true, NULL, '2026-03-11 11:06:19.903713+00'),
('3ad1da03-c8cd-4ceb-8507-afc6fb199565', '430',  'Clientes',                                          'activo',     'debe',  true, NULL, '2026-03-11 11:06:19.903713+00'),
('470d1778-6986-4764-92c3-f12d498ffd1e', '600',  'Compras de mercaderías',                            'gasto',      'debe',  true, NULL, '2026-03-11 11:06:19.903713+00'),
('526a46db-32c3-4584-8169-ec0c453e7582', '4109', 'Acreedores, pagos pend. de formalizar (Puente)',   'pasivo',     'haber', true, NULL, '2026-04-14 11:53:45.985944+00'),
('591c8f33-196e-4758-bcd8-e202b13cf0f9', '472',  'Hacienda Pública, IVA soportado',                  'activo',     'debe',  true, NULL, '2026-03-11 11:06:19.903713+00'),
('768d7db2-7c17-460c-b306-4251202a4045', '570',  'Caja Efectivo',                                     'activo',     'debe',  true, NULL, '2026-03-11 11:06:19.903713+00'),
('a2b6745b-0713-44c9-ba98-7911d3b7761a', '769',  'Otros ingresos financieros / Redondeo',             'ingreso',    'haber', true, NULL, '2026-03-14 18:00:34.942719+00'),
('ad856b43-58ce-4299-a695-6462e99eb3ae', '705',  'Prestación de servicios / Comisiones',              'ingreso',    'haber', true, NULL, '2026-03-11 11:06:19.903713+00'),
('b1d90509-9400-4945-b079-15b42fd946d6', '555',  'Partidas pendientes de aplicación',                 'activo',     'debe',  true, NULL, '2026-03-11 11:06:19.903713+00'),
('b2ec0670-cd30-4a59-9375-c42d3b658d6e', '669',  'Otros gastos financieros / Redondeo',               'gasto',      'debe',  true, NULL, '2026-03-14 18:00:34.942719+00'),
('baed98d1-abf1-471a-9d57-848f6f3a4ec0', '754',  'Ingresos por anulaciones / Penalizaciones',         'ingreso',    'haber', true, NULL, '2026-03-11 11:06:19.903713+00'),
('c9422df9-84ad-4162-a47b-02a445fbde06', '477',  'Hacienda Pública, IVA repercutido',                 'pasivo',     'haber', true, NULL, '2026-03-11 11:06:19.903713+00'),
('cc915825-296f-4d51-91a5-2bdbd29b56fa', '629',  'Otros servicios / Gastos de viaje',                 'gasto',      'debe',  true, NULL, '2026-04-09 16:05:47.309698+00'),
('da0c079e-eb96-4057-88e7-297eedbde7a6', '400',  'Proveedores',                                       'pasivo',     'haber', true, NULL, '2026-03-11 11:06:19.903713+00'),
('e7d4d966-1d47-40a6-908e-9d13f8db65c6', '410',  'Acreedores por prestación de servicios',            'pasivo',     'haber', true, NULL, '2026-03-11 11:06:19.903713+00'),
('fd9b798d-c13a-47f0-b638-3772d767f885', '438',  'Anticipos de clientes',                             'pasivo',     'haber', true, NULL, '2026-03-11 11:06:19.903713+00')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- OPERATIVA: COTIZACIONES Y LÍNEAS DE COTIZACIÓN
-- ============================================================

CREATE TABLE IF NOT EXISTS operativa_cotizaciones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id       UUID REFERENCES operativa_expedientes(id) ON DELETE CASCADE,
    contacto            UUID REFERENCES contabilidad_entidades(id) ON DELETE SET NULL,
    titulo              VARCHAR(255) NOT NULL DEFAULT 'Cotización',
    pvp_viajero         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    plazas              INTEGER NOT NULL DEFAULT 1,
    free                INTEGER NOT NULL DEFAULT 0,
    coste_viajero       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_coste         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_ingresos      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_beneficio     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    margen_beneficio    DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    estado              VARCHAR(20) NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'presentada', 'aceptada', 'rechazada')),
    suplementos         TEXT,
    destinos            JSONB DEFAULT '[]'::jsonb,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_expediente ON operativa_cotizaciones(expediente_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado     ON operativa_cotizaciones(estado);

ALTER TABLE operativa_cotizaciones ADD COLUMN IF NOT EXISTS destinos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE operativa_cotizaciones ADD COLUMN IF NOT EXISTS fecha_salida DATE;
ALTER TABLE operativa_cotizaciones ADD COLUMN IF NOT EXISTS fecha_regreso DATE;
ALTER TABLE operativa_cotizaciones ADD COLUMN IF NOT EXISTS agente_id TEXT;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_agente ON operativa_cotizaciones(agente_id);

-- Persona de contacto responsable dentro de la empresa/grupo seleccionada en `contacto`
-- (solo aplica cuando `contacto` es una entidad tipo Empresa/Grupo; para clientes tipo
-- Persona, `contacto` ya identifica directamente a la persona y esto queda NULL).
ALTER TABLE operativa_cotizaciones ADD COLUMN IF NOT EXISTS contacto_persona_id UUID REFERENCES crm_contactos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_contacto_persona ON operativa_cotizaciones(contacto_persona_id);

CREATE TABLE IF NOT EXISTS operativa_cotizacion_lineas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotizacion_id       UUID NOT NULL REFERENCES operativa_cotizaciones(id) ON DELETE CASCADE,
    tipo                UUID NOT NULL REFERENCES config_tipos_servicios(id) ON DELETE RESTRICT,
    -- Si migras desde VARCHAR, ejecuta antes: ALTER TABLE operativa_cotizacion_lineas DROP CONSTRAINT IF EXISTS operativa_cotizacion_lineas_tipo_check;
    descripcion         TEXT NOT NULL,
    proveedor           TEXT REFERENCES public.contabilidad_proveedores(id) ON DELETE SET NULL,
    destino             UUID REFERENCES public.maestro_destinos(id) ON DELETE SET NULL,
    plazas              INTEGER,
    noches              INTEGER,
    neto                DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    pvp                 DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_neto          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_pvp           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    checked                BOOLEAN NOT NULL DEFAULT true,
    opcional               BOOLEAN NOT NULL DEFAULT false,
    grupo_alternativa_id   UUID,
    detalles               JSONB DEFAULT '{}'::jsonb,
    created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cotizacion_lineas_cotizacion ON operativa_cotizacion_lineas(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_cotizacion_lineas_opcional   ON operativa_cotizacion_lineas(opcional);
CREATE INDEX IF NOT EXISTS idx_cotizacion_lineas_grupo_alternativa ON operativa_cotizacion_lineas(grupo_alternativa_id);

-- Añade el estado de confirmación a cada línea de cotización, para distinguir
-- entre servicios ya confirmados con el proveedor y pendientes de confirmar.
ALTER TABLE public.operativa_cotizacion_lineas
ADD COLUMN IF NOT EXISTS confirmado BOOLEAN NOT NULL DEFAULT false;

INSERT INTO config_tipos_servicios (id, etiqueta, icono, contenido) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'Hotel',        'bed',      '{"color": "#3b82f6"}'),
    ('a2222222-2222-2222-2222-222222222222', 'Vuelo',        'plane',    '{"color": "#8b5cf6"}'),
    ('a3333333-3333-3333-3333-333333333333', 'Excursión',    'compass',  '{"color": "#10b981"}'),
    ('a4444444-4444-4444-4444-444444444444', 'Traslado',     'map-pin',  '{"color": "#f59e0b"}'),
    ('a5555555-5555-5555-5555-555555555555', 'Otro',         'more',     '{"color": "#64748b"}'),
    ('a6666666-6666-6666-6666-666666666666', 'Seguro',       'shield',   '{"color": "#db2777"}'),
    ('a7777777-7777-7777-7777-777777777777', 'Seguros',       'shield',   '{"color": "#db2777"}')
ON CONFLICT (id) DO NOTHING;

-- 2026-05-26: Agrupación de alternativas (hotel A vs hotel B, etc.)
-- Ejecutar en cada base de datos de agencia:
-- ALTER TABLE public.operativa_cotizacion_lineas ADD COLUMN grupo_alternativa_id UUID NULL;
-- CREATE INDEX IF NOT EXISTS idx_cotizacion_lineas_grupo_alternativa ON public.operativa_cotizacion_lineas USING btree (grupo_alternativa_id);

-- Tabla intermedia: líneas reales de cada servicio de expediente (desglose de cotización)
CREATE TABLE IF NOT EXISTS operativa_expediente_servicio_lineas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    servicio_id         UUID NOT NULL REFERENCES operativa_expedientes_servicios(id) ON DELETE CASCADE,
    cotizacion_linea_id UUID REFERENCES operativa_cotizacion_lineas(id) ON DELETE SET NULL,
    tipo                UUID REFERENCES config_tipos_servicios(id) ON DELETE SET NULL,
    descripcion         TEXT,
    neto                DECIMAL(12,2) DEFAULT 0.00,
    pvp                 DECIMAL(12,2) DEFAULT 0.00,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servicio_lineas_servicio ON operativa_expediente_servicio_lineas(servicio_id);

-- ============================================================
-- MÓDULO: DOCUMENTOS PROVEEDOR + EXTRACCIÓN IA
-- Añadido: 2026-05-27
-- ============================================================

-- ------------------------------------------------------------
-- 1. AMPLIAR config_tipos_servicios
-- ------------------------------------------------------------
ALTER TABLE config_tipos_servicios
  ADD COLUMN IF NOT EXISTS palabras_clave      TEXT,
  ADD COLUMN IF NOT EXISTS descripcion_agente  TEXT,
  ADD COLUMN IF NOT EXISTS activo              BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS idx                 INTEGER DEFAULT 0;

UPDATE config_tipos_servicios SET palabras_clave = 'hotel, habitación, hab, room, pensión completa, PC, media pensión, MP, alojamiento y desayuno, BB, solo alojamiento, RO, resort, hostel', descripcion_agente = 'Alojamiento en cualquier tipo de establecimiento hotelero o similar', activo = true, idx = 0 WHERE etiqueta IN ('Hotel','Alojamiento');
UPDATE config_tipos_servicios SET palabras_clave = 'billete avión, ticket aéreo, tasas aéreas, vuelo, ruta IATA, localizador GDS', descripcion_agente = 'Billetes aéreos individuales o grupales incluyendo tasas aeroportuarias', activo = true, idx = 1 WHERE etiqueta IN ('Vuelo','Vuelos');
UPDATE config_tipos_servicios SET palabras_clave = 'autocar, autobús, bus, chófer en factura transporte, transfer, traslado, taxi, conductor en bono', descripcion_agente = 'Servicios de transporte terrestre. OJO: chófer en factura de hotel = Alojamiento', activo = true, idx = 2 WHERE etiqueta IN ('Traslado','Desplazamientos');
UPDATE config_tipos_servicios SET palabras_clave = 'rafting, paintball, quads, 4x4, visita guiada, guía oficial, excursión, tour, actividad, circuito', descripcion_agente = 'Actividades turísticas, excursiones y visitas guiadas', activo = true, idx = 3 WHERE etiqueta IN ('Excursión','Actividades y excursiones','Entradas');
UPDATE config_tipos_servicios SET palabras_clave = 'seguro viaje, seguro anulación, prima, certificado, póliza, bordero, asistencia, CASER, ARAG, ERGO, IMA, AON', descripcion_agente = 'Seguros de viaje y asistencia. Borderos de liquidación mensual de primas', activo = true, idx = 4 WHERE etiqueta IN ('Seguro','Seguros');
UPDATE config_tipos_servicios SET palabras_clave = 'comisión, cargo administrativo, descuento, gratuidad, suplemento, property fee, otros conceptos', descripcion_agente = 'Conceptos no clasificables en otras categorías', activo = true, idx = 5 WHERE etiqueta IN ('Otro','Otros');

-- ------------------------------------------------------------
-- 2. TABLA PRINCIPAL DE DOCUMENTOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operativa_documentos_proveedor (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id              TEXT REFERENCES contabilidad_proveedores(id),
  documento_numero          VARCHAR(100),
  documento_tipo            VARCHAR(30) CHECK (documento_tipo IN (
                              'FACTURA','PROFORMA','BORDERO_SEGUROS','ALBARAN'
                            )),
  fecha_emision             DATE,
  periodo_desde             DATE,
  periodo_hasta             DATE,
  archivo_nombre            VARCHAR(255) NOT NULL,
  archivo_url               VARCHAR(500) NOT NULL,
  archivo_path              VARCHAR(500) NOT NULL,
  archivo_size_kb           INT,
  extraccion_json           JSONB,
  extraccion_url            VARCHAR(500),
  extraccion_version        INT DEFAULT 0,
  extraccion_modelo         VARCHAR(100),
  extraccion_tokens_input   INT,
  extraccion_tokens_output  INT,
  extraccion_coste_usd      DECIMAL(10,6),
  procesado_ia              BOOLEAN DEFAULT false,
  procesado_at              TIMESTAMP,
  total_base                DECIMAL(10,2),
  total_iva                 DECIMAL(10,2),
  total_documento           DECIMAL(10,2),
  estado_pago               VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado_pago IN ('PENDIENTE','PARCIAL','PAGADO')),
  importe_pagado            DECIMAL(10,2) DEFAULT 0.00,
  importe_pendiente         DECIMAL(10,2),
  created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE operativa_expedientes_servicios
    ADD COLUMN IF NOT EXISTS documento_id UUID REFERENCES operativa_documentos_proveedor(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expedientes_servicios_documento  ON operativa_expedientes_servicios(documento_id);

-- ------------------------------------------------------------
-- 3. RELACIÓN N:M DOCUMENTOS ↔ EXPEDIENTES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operativa_documentos_expedientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id    UUID NOT NULL REFERENCES operativa_documentos_proveedor(id) ON DELETE CASCADE,
  expediente_id   UUID NOT NULL REFERENCES operativa_expedientes(id) ON DELETE CASCADE,
  es_principal    BOOLEAN DEFAULT false,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(documento_id, expediente_id)
);

-- ------------------------------------------------------------
-- 4. LÍNEAS EXTRAÍDAS POR LA IA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operativa_documentos_lineas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id            UUID NOT NULL REFERENCES operativa_documentos_proveedor(id) ON DELETE CASCADE,
  expediente_id           UUID REFERENCES operativa_expedientes(id),
  tipo_servicio_id        UUID REFERENCES config_tipos_servicios(id),
  tipo_servicio_etiqueta  VARCHAR(100),
  concepto                TEXT NOT NULL,
  fecha_inicio            DATE,
  fecha_fin               DATE,
  noches                  INT,
  pax                     INT,
  unidades                INT,
  precio_unitario         DECIMAL(10,2),
  base_imponible          DECIMAL(10,2),
  iva_porcentaje          DECIMAL(5,2)  DEFAULT 0,
  iva_importe             DECIMAL(10,2) DEFAULT 0,
  iva_incluido            BOOLEAN DEFAULT false,
  total_linea             DECIMAL(10,2),
  es_descuento            BOOLEAN DEFAULT false,
  pasajero                VARCHAR(200),
  tasas                   DECIMAL(10,2),
  property_fee            DECIMAL(10,2),
  regimen                 VARCHAR(50),
  establecimiento         VARCHAR(200),
  aplicacion_aon          VARCHAR(50),
  certificado             VARCHAR(100),
  compania_seguro         VARCHAR(200),
  modalidad_seguro        VARCHAR(200),
  prima_liquida           DECIMAL(10,2),
  bordero_id              UUID REFERENCES operativa_documentos_proveedor(id),
  referencia_agencia      VARCHAR(200),
  estado_servicio         VARCHAR(30) DEFAULT 'ACTIVO' CHECK (estado_servicio IN ('ACTIVO','ANULADO','PENDIENTE_BORDERO','CONCILIADO')),
  notas                   TEXT,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 5. PAGOS DE DOCUMENTOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operativa_documentos_pagos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id        UUID NOT NULL REFERENCES operativa_documentos_proveedor(id) ON DELETE CASCADE,
  fecha_movimiento    DATE NOT NULL,
  importe             DECIMAL(10,2) NOT NULL,
  metodo_pago         VARCHAR(30) CHECK (metodo_pago IN ('TRANSFERENCIA','DEPOSITO','TARJETA','EFECTIVO','DOMICILIACION')),
  referencia          VARCHAR(200),
  movimiento_banco_id UUID REFERENCES contabilidad_movimientos_banco(id),
  notas               TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 6. ÍNDICES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_op_docs_proveedor    ON operativa_documentos_proveedor(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_op_docs_tipo         ON operativa_documentos_proveedor(documento_tipo);
CREATE INDEX IF NOT EXISTS idx_op_docs_estado_pago  ON operativa_documentos_proveedor(estado_pago);
CREATE INDEX IF NOT EXISTS idx_op_docs_procesado    ON operativa_documentos_proveedor(procesado_ia);
CREATE INDEX IF NOT EXISTS idx_op_docs_fecha        ON operativa_documentos_proveedor(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_op_docs_exp_exp      ON operativa_documentos_expedientes(expediente_id);
CREATE INDEX IF NOT EXISTS idx_op_docs_exp_doc      ON operativa_documentos_expedientes(documento_id);
CREATE INDEX IF NOT EXISTS idx_op_lineas_documento  ON operativa_documentos_lineas(documento_id);
CREATE INDEX IF NOT EXISTS idx_op_lineas_expediente ON operativa_documentos_lineas(expediente_id);
CREATE INDEX IF NOT EXISTS idx_op_lineas_tipo       ON operativa_documentos_lineas(tipo_servicio_id);
CREATE INDEX IF NOT EXISTS idx_op_lineas_estado     ON operativa_documentos_lineas(estado_servicio);
CREATE INDEX IF NOT EXISTS idx_op_lineas_cert       ON operativa_documentos_lineas(certificado);

-- Vincula documentos de proveedor (facturas/proformas) a pagos concretos (contabilidad_movimientos).
-- Relación N:M: un documento puede cubrir varios pagos (p. ej. una factura grande pagada en
-- varias transferencias), de ahí la tabla puente en vez de una FK directa.
CREATE TABLE IF NOT EXISTS contabilidad_movimientos_documentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id UUID NOT NULL REFERENCES contabilidad_movimientos(id) ON DELETE CASCADE,
  documento_id  UUID NOT NULL REFERENCES operativa_documentos_proveedor(id) ON DELETE CASCADE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (movimiento_id, documento_id)
);

CREATE INDEX IF NOT EXISTS idx_mov_docs_movimiento ON contabilidad_movimientos_documentos(movimiento_id);
CREATE INDEX IF NOT EXISTS idx_mov_docs_documento ON contabilidad_movimientos_documentos(documento_id);
CREATE INDEX IF NOT EXISTS idx_op_lineas_ref        ON operativa_documentos_lineas(referencia_agencia);
CREATE INDEX IF NOT EXISTS idx_op_pagos_documento   ON operativa_documentos_pagos(documento_id);
CREATE INDEX IF NOT EXISTS idx_op_pagos_mov_banco   ON operativa_documentos_pagos(movimiento_banco_id);

-- ------------------------------------------------------------
-- 7. TRIGGERS
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_op_docs_updated ON operativa_documentos_proveedor;
CREATE TRIGGER trg_op_docs_updated
  BEFORE UPDATE ON operativa_documentos_proveedor
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_op_lineas_updated ON operativa_documentos_lineas;
CREATE TRIGGER trg_op_lineas_updated
  BEFORE UPDATE ON operativa_documentos_lineas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION calcular_importe_pendiente()
RETURNS TRIGGER AS $$
BEGIN
  NEW.importe_pendiente = COALESCE(NEW.total_documento, 0) - COALESCE(NEW.importe_pagado, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calcular_pendiente ON operativa_documentos_proveedor;
CREATE TRIGGER trg_calcular_pendiente
  BEFORE INSERT OR UPDATE ON operativa_documentos_proveedor
  FOR EACH ROW EXECUTE FUNCTION calcular_importe_pendiente();

-- ------------------------------------------------------------
-- 8. RLS
-- ------------------------------------------------------------
ALTER TABLE operativa_documentos_proveedor   ENABLE ROW LEVEL SECURITY;
ALTER TABLE operativa_documentos_expedientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE operativa_documentos_lineas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE operativa_documentos_pagos       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados lectura documentos"    ON operativa_documentos_proveedor   FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados insertar documentos"   ON operativa_documentos_proveedor   FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados actualizar documentos" ON operativa_documentos_proveedor   FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados lectura docs-exp"      ON operativa_documentos_expedientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados insertar docs-exp"     ON operativa_documentos_expedientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados lectura lineas"        ON operativa_documentos_lineas      FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados insertar lineas"       ON operativa_documentos_lineas      FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados actualizar lineas"     ON operativa_documentos_lineas      FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados lectura pagos"        ON operativa_documentos_pagos       FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados insertar pagos"        ON operativa_documentos_pagos       FOR INSERT TO authenticated WITH CHECK (true);

-- ------------------------------------------------------------
-- 9. FUNCIONES ADICIONALES (MOMO CONTABLE)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_balance_sumas_saldos(p_ejercicio INT)
RETURNS TABLE (
  subcuenta VARCHAR,
  nombre_cuenta VARCHAR,
  total_debe NUMERIC,
  total_haber NUMERIC,
  saldo_final NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.subcuenta::VARCHAR,
    MAX(COALESCE(cc.descripcion, ap.concepto, ap.subcuenta))::VARCHAR as nombre_cuenta,
    SUM(ap.debe)::NUMERIC as total_debe,
    SUM(ap.haber)::NUMERIC as total_haber,
    (SUM(ap.debe) - SUM(ap.haber))::NUMERIC as saldo_final
  FROM public.contabilidad_apuntes ap
  JOIN public.contabilidad_asientos a ON ap.asiento_id = a.id
  LEFT JOIN public.config_cuentas_contables cc ON ap.subcuenta = cc.codigo
  WHERE a.ejercicio = p_ejercicio
  GROUP BY ap.subcuenta
  ORDER BY ap.subcuenta ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MÓDULO: FACTURACIÓN HÍBRIDA (GENERAL Y REAV) + LIBRO DE IVA
-- Ajustes y extensiones sobre el esquema de Groomy (2026)
-- ============================================================

-- 1. Creamos el ENUM para definir el comportamiento fiscal de las facturas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'regimen_iva_enum') THEN
        CREATE TYPE regimen_iva_enum AS ENUM ('REAV', 'GENERAL');
    END IF;
END
$$;

-- 2. Añadimos la sugerencia de IVA en la tabla de expedientes existente
ALTER TABLE public.operativa_expedientes 
ADD COLUMN IF NOT EXISTS regimen_iva_sugerido regimen_iva_enum DEFAULT 'REAV';


-- 3. NUEVA TABLA: Facturas Emitidas (Cabecera de Ventas / Ingresos)
CREATE TABLE IF NOT EXISTS public.facturas_emitidas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id   UUID REFERENCES public.operativa_expedientes(id) ON DELETE RESTRICT NOT NULL,
    pagador_id      UUID REFERENCES public.contabilidad_entidades(id) ON DELETE SET NULL, -- Enlace al tutor/pagador de operativa_pagadores_expedientes
    numero_factura  VARCHAR(100) UNIQUE NOT NULL, -- Ej: F2026-001
    fecha_emision   DATE NOT NULL DEFAULT CURRENT_DATE,
    cliente_nombre  TEXT NOT NULL, -- Nombre del tutor, empresa o colegio receptor
    cliente_nif     VARCHAR(20) NOT NULL,
    regimen_iva     regimen_iva_enum NOT NULL, -- 🎯 Envía la factura a la tabla verde o azul del Libro de IVA
    importe_total   NUMERIC(12, 2) NOT NULL, -- PVP cobrado final
    verifactu_estado VARCHAR(50) NOT NULL DEFAULT 'NO_ENVIADO', -- 🎯 Estado de envío a Verifactu
    verifactu_qr    TEXT, -- Imagen QR o texto base64 devuelto por Verifactu
    verifactu_fingerprint TEXT, -- Huella/firma digital devuelta por Verifactu
    verifactu_mensaje TEXT, -- Mensaje de éxito o descripción de error
    verifactu_fecha_declaracion TIMESTAMP WITH TIME ZONE, -- Fecha y hora de envío a la AEAT
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);


-- 4. NUEVA TABLA: Líneas de Facturas Emitidas
CREATE TABLE IF NOT EXISTS public.facturas_emitidas_lineas (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_emitida_id UUID REFERENCES public.facturas_emitidas(id) ON DELETE CASCADE NOT NULL,
    concepto           TEXT NOT NULL,
    importe_neto       NUMERIC(12, 2) NOT NULL, -- REAV = PVP total | General = Base Imponible
    porcentaje_iva     NUMERIC(5, 2) DEFAULT 0.00 NOT NULL, -- REAV = 0.00 | General = 21.00, 10.00...
    cuota_iva          NUMERIC(12, 2) DEFAULT 0.00 NOT NULL, -- Solo aplicable en Régimen General
    importe_total_linea NUMERIC(12, 2) NOT NULL
);


-- 5. NUEVA TABLA: Facturas Recibidas (Cabecera de Gastos de Proveedores)
CREATE TABLE IF NOT EXISTS public.facturas_recibidas (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id            UUID REFERENCES public.operativa_expedientes(id) ON DELETE RESTRICT NOT NULL,
    proveedor_id             TEXT REFERENCES public.contabilidad_proveedores(id) ON DELETE RESTRICT NOT NULL, -- Refers to contabilidad_proveedores(id)
    numero_factura_proveedor VARCHAR(100) NOT NULL,
    fecha_factura            DATE NOT NULL,
    importe_total_con_iva    NUMERIC(12, 2) NOT NULL, -- Coste bruto con IVA
    created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
);


-- 6. NUEVA TABLA: Líneas de Facturas Recibidas
CREATE TABLE IF NOT EXISTS public.facturas_recibidas_lineas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_recibida_id UUID REFERENCES public.facturas_recibidas(id) ON DELETE CASCADE NOT NULL,
    concepto            TEXT NOT NULL,
    importe_base        NUMERIC(12, 2) NOT NULL,
    porcentaje_iva      NUMERIC(5, 2) NOT NULL, 
    importe_iva         NUMERIC(12, 2) NOT NULL,
    importe_total_linea NUMERIC(12, 2) NOT NULL
);


-- 7. ADAPTACIÓN EN LA TABLA: contabilidad_apuntes (Vuestro Libro Diario)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'regimen_iva_apunte_enum') THEN
        CREATE TYPE regimen_iva_apunte_enum AS ENUM ('REAV', 'GENERAL', 'EXENTO');
    END IF;
END
$$;

ALTER TABLE public.contabilidad_apuntes ADD COLUMN IF NOT EXISTS proveedor_id TEXT REFERENCES public.contabilidad_proveedores(id);
CREATE INDEX IF NOT EXISTS idx_apuntes_proveedor ON contabilidad_apuntes(proveedor_id);

ALTER TABLE public.contabilidad_movimientos_banco ADD COLUMN IF NOT EXISTS apunte_id UUID REFERENCES contabilidad_apuntes(id);
CREATE INDEX IF NOT EXISTS idx_banco_apunte ON contabilidad_movimientos_banco(apunte_id);
ALTER TABLE public.contabilidad_apuntes ADD COLUMN IF NOT EXISTS expediente_id UUID REFERENCES public.operativa_expedientes(id) ON DELETE CASCADE;
ALTER TABLE public.contabilidad_apuntes ADD COLUMN IF NOT EXISTS factura_emitida_id UUID REFERENCES public.facturas_emitidas(id) ON DELETE SET NULL;
ALTER TABLE public.contabilidad_apuntes ADD COLUMN IF NOT EXISTS factura_recibida_id UUID REFERENCES public.facturas_recibidas(id) ON DELETE SET NULL;
ALTER TABLE public.contabilidad_apuntes ADD COLUMN IF NOT EXISTS regimen_iva_apunte regimen_iva_apunte_enum DEFAULT 'REAV';

-- Triggers para campos updated_at (Usando la función existente update_updated_at)
DROP TRIGGER IF EXISTS trg_facturas_emitidas_updated ON public.facturas_emitidas;
CREATE TRIGGER trg_facturas_emitidas_updated 
    BEFORE UPDATE ON public.facturas_emitidas 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_facturas_recibidas_updated ON public.facturas_recibidas;
CREATE TRIGGER trg_facturas_recibidas_updated 
    BEFORE UPDATE ON public.facturas_recibidas 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Índices de Rendimiento Críticos para el Libro de IVA y Prorrata
CREATE INDEX IF NOT EXISTS idx_facturas_emitidas_expediente ON public.facturas_emitidas(expediente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_emitidas_pagador ON public.facturas_emitidas(pagador_id);
CREATE INDEX IF NOT EXISTS idx_facturas_emitidas_regimen ON public.facturas_emitidas(regimen_iva);
CREATE INDEX IF NOT EXISTS idx_facturas_emitidas_fecha ON public.facturas_emitidas(fecha_emision);

CREATE INDEX IF NOT EXISTS idx_facturas_recibidas_expediente ON public.facturas_recibidas(expediente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_recibidas_proveedor ON public.facturas_recibidas(proveedor_id);

-- Vista para matching de servicios bancarios: precalcula importe efectivo + join expediente
CREATE OR REPLACE VIEW public.v_servicios_match AS
SELECT s.id, s.expediente_id, s.proveedor, s.descripcion, s.total, s.pvp, s.neto,
       COALESCE(NULLIF(s.total, 0), NULLIF(s.pvp, 0), NULLIF(s.neto, 0), 0) AS importe_efectivo,
       e.numero AS exp_numero, e.referencia AS exp_referencia
FROM public.operativa_expedientes_servicios s
LEFT JOIN public.operativa_expedientes e ON e.id = s.expediente_id;

-- Vista para calcular total abonado por servicio
-- Fuente: contabilidad_movimientos (tipo=pago) + join a banco para extraer servicio_id
CREATE OR REPLACE VIEW public.v_abonados_servicios AS
WITH direct AS (
  SELECT (cmb.match_metadatos->>'servicio_id')::uuid AS servicio_id,
         cm.importe_total::numeric AS abonado
  FROM contabilidad_movimientos cm
  JOIN contabilidad_movimientos_banco cmb ON cmb.id = cm.movimiento_banco_id
  WHERE cm.tipo = 'pago'
    AND cm.estado = 'confirmado'
    AND cmb.match_metadatos ? 'servicio_id'
    AND cmb.match_metadatos->>'servicio_id' IS NOT NULL
    AND cmb.match_metadatos->>'servicio_id' != 'null'
),
grouped AS (
  SELECT (p.value->>'id')::uuid AS servicio_id,
         ABS((p.value->>'importe')::numeric) AS abonado
  FROM contabilidad_movimientos cm
  JOIN contabilidad_movimientos_banco cmb ON cmb.id = cm.movimiento_banco_id
  CROSS JOIN jsonb_array_elements(cmb.match_metadatos->'pagos') AS p(value)
  WHERE cm.tipo = 'pago'
    AND cm.estado = 'confirmado'
    AND (cmb.match_metadatos->>'origen') = 'servicio'
    AND cmb.match_metadatos ? 'pagos'
),
desde_documento AS (
  SELECT oes.id AS servicio_id,
         ABS((p.value->>'importe')::numeric) AS abonado
  FROM contabilidad_movimientos_banco cmb
  CROSS JOIN jsonb_array_elements(cmb.match_metadatos->'pagos') AS p(value)
  JOIN operativa_expedientes_servicios oes ON oes.documento_id = (p.value->>'documento_id')::uuid
  WHERE cmb.match_metadatos ? 'pagos'
    AND p.value ? 'documento_id'
    AND p.value->>'documento_id' IS NOT NULL
    AND p.value->>'documento_id' != 'null'
    AND (cmb.match_metadatos->>'origen' IS NULL OR cmb.match_metadatos->>'origen' != 'servicio')
    AND EXISTS (
      SELECT 1 FROM contabilidad_movimientos cm
      WHERE cm.movimiento_banco_id = cmb.id
        AND cm.tipo = 'pago'
        AND cm.estado = 'confirmado'
    )
),
combined AS (
  SELECT servicio_id, abonado FROM direct
  UNION ALL
  SELECT servicio_id, abonado FROM grouped
  UNION ALL
  SELECT servicio_id, abonado FROM desde_documento
)
SELECT servicio_id, SUM(abonado) AS total_abonado
FROM combined
WHERE servicio_id IS NOT NULL
GROUP BY servicio_id;

CREATE INDEX IF NOT EXISTS idx_apuntes_proveedor ON public.contabilidad_apuntes(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_apuntes_expediente ON public.contabilidad_apuntes(expediente_id);
CREATE INDEX IF NOT EXISTS idx_apuntes_factura_emitida ON public.contabilidad_apuntes(factura_emitida_id);
CREATE INDEX IF NOT EXISTS idx_apuntes_factura_recibida ON public.contabilidad_apuntes(factura_recibida_id);
CREATE INDEX IF NOT EXISTS idx_apuntes_regimen_iva ON public.contabilidad_apuntes(regimen_iva_apunte);

-- ============================================================
-- SISTEMA DE SINCRONIZACIÓN TPV
-- ============================================================

-- Nueva tabla para registrar tiquetes TPV importados
CREATE TABLE IF NOT EXISTS tpv_tiquetes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_tiquete VARCHAR(20) NOT NULL,
  fecha DATE NOT NULL,
  hora_cierre TIME,
  proveedor VARCHAR(50),
  subtotal DECIMAL(10,2),
  comision DECIMAL(10,2),
  total DECIMAL(10,2),
  
  -- OCR Quality
  confianza_ocr NUMERIC(3,2),
  imagen_url TEXT,
  
  -- Estado de sincronización
  estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, sincronizado, conflicto, rechazado
  
  -- Auditoría
  importado_at TIMESTAMP DEFAULT NOW(),
  importado_por VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(numero_tiquete, fecha)
);

CREATE INDEX IF NOT EXISTS idx_tpv_tiquetes_fecha ON tpv_tiquetes(fecha);
CREATE INDEX IF NOT EXISTS idx_tpv_tiquetes_estado ON tpv_tiquetes(estado);

-- Tabla detalle de transacciones del tiquete
CREATE TABLE IF NOT EXISTS tpv_tiquetes_transacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiquete_id UUID NOT NULL REFERENCES tpv_tiquetes(id) ON DELETE CASCADE,
  hora TIME,
  numero_transaccion VARCHAR(20),
  tipo VARCHAR(50), -- VENTA, DEVOLUCIÓN, etc
  importe DECIMAL(10,2),
  confianza NUMERIC(3,2),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de relación: transacción TPV ↔ movimiento BD
CREATE TABLE IF NOT EXISTS tpv_movimientos_matched (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaccion_tpv_id UUID NOT NULL REFERENCES tpv_tiquetes_transacciones(id) ON DELETE CASCADE,
  movimiento_bd_id UUID NOT NULL REFERENCES contabilidad_movimientos(id) ON DELETE CASCADE,
  score_match NUMERIC(3,0),
  razon VARCHAR(500),
  confirmado_por VARCHAR(255),
  confirmado_at TIMESTAMP,
  estado VARCHAR(20) DEFAULT 'propuesto', -- propuesto, confirmado, rechazado
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(transaccion_tpv_id, movimiento_bd_id)
);

CREATE INDEX IF NOT EXISTS idx_tpv_mov_matched_score ON tpv_movimientos_matched(score_match);

-- Añadir columna de referencia en contabilidad_movimientos
ALTER TABLE contabilidad_movimientos ADD COLUMN IF NOT EXISTS tpv_tiquete_id UUID REFERENCES tpv_tiquetes(id);

-- Proveedor vinculado al movimiento (para pagos a proveedores)
ALTER TABLE contabilidad_movimientos ADD COLUMN IF NOT EXISTS proveedor_id TEXT REFERENCES contabilidad_proveedores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_proveedor ON contabilidad_movimientos(proveedor_id);

-- ── Cierres de caja diarios ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contabilidad_cierres_caja (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha               DATE NOT NULL UNIQUE,

  -- Teórico: cobros registrados en la app ese día
  efectivo_teorico    DECIMAL(10,2) NOT NULL DEFAULT 0,
  tpv_teorico         DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Físico: recuento arqueo + suma tiquetes TPV del día
  efectivo_fisico     DECIMAL(10,2) NOT NULL DEFAULT 0,
  tpv_fisico          DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Diferencias auto-calculadas al guardar
  diferencia_efectivo DECIMAL(10,2) NOT NULL DEFAULT 0,
  diferencia_tpv      DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Agente que realiza el cierre
  agente_nombre       VARCHAR(255),

  -- Detalle del arqueo (cantidades por denominación como JSON)
  arqueo_detalle      JSONB,

  estado              VARCHAR(20) DEFAULT 'cerrado',
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cierres_caja_fecha
  ON contabilidad_cierres_caja(fecha DESC);

-- ============================================================
-- FUNCIÓN: fn_ejecutar_conciliacion_groomy
-- Concilia un movimiento bancario con un expediente/tutor de
-- forma atómica: inserta contabilidad_movimientos, genera los
-- apuntes 572/438 si el expediente lo requiere, marca el
-- movimiento bancario como conciliado y actualiza el saldo
-- del pagador en operativa_pagadores_expedientes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_ejecutar_conciliacion_groomy(
  p_movimiento_banco_id uuid,
  p_entidad_id          uuid,
  p_expediente_id       uuid,
  p_usuario_id          text,
  p_importe_imputado    numeric DEFAULT NULL::numeric
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    v_mov_banco                 RECORD;
    v_expediente                RECORD;
    v_tutor                     RECORD;
    v_importe_numerico          DECIMAL(12,2);
    v_fecha_movimiento          DATE;
    v_se_deben_generar_apuntes  BOOLEAN := FALSE;
    v_subcuenta_cliente         VARCHAR(20);
    v_codigo_anticipo_calculado VARCHAR(20);
    v_nuevo_movimiento_id       UUID;
    v_cta_banco_id              UUID;
    v_cta_anticipo_id           UUID;
    v_subcuenta_banco           VARCHAR(20);
    v_balance_pagador           RECORD;
    v_acumulado_actualizado     DECIMAL(12,2);
    v_estado_cobro_final        VARCHAR(20);
    v_tipo_conciliacion         VARCHAR(20);
    v_concepto_banco            VARCHAR(500);
    v_concepto_anticipo         VARCHAR(500);
    v_apunte_id                 UUID;
    v_response                  JSONB;
BEGIN
    -- 1. Obtener y bloquear el movimiento bancario
    SELECT * INTO v_mov_banco
    FROM contabilidad_movimientos_banco
    WHERE id = p_movimiento_banco_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movimiento bancario no localizado.';
    END IF;

    IF v_mov_banco.estado = 'conciliado' THEN
        RAISE EXCEPTION 'Este movimiento ya fue conciliado previamente.';
    END IF;

    v_importe_numerico := COALESCE(p_importe_imputado, v_mov_banco.importe);
    v_fecha_movimiento := v_mov_banco.fecha_operacion;

    -- 2. Obtener reglas del expediente
    SELECT genera_apunte, apuntes_desde, referencia
    INTO v_expediente
    FROM operativa_expedientes
    WHERE id = p_expediente_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Imposible obtener las reglas de control del expediente.';
    END IF;

    IF v_expediente.genera_apunte = TRUE THEN
        IF v_expediente.apuntes_desde IS NULL THEN
            v_se_deben_generar_apuntes := TRUE;
        ELSE
            IF v_fecha_movimiento >= v_expediente.apuntes_desde THEN
                v_se_deben_generar_apuntes := TRUE;
            END IF;
        END IF;
    END IF;

    -- 3. Obtener datos del tutor y resolver subcuenta contable
    SELECT nombre, cuentas_contables
    INTO v_tutor
    FROM contabilidad_entidades
    WHERE id = p_entidad_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El tutor seleccionado no existe en la base de datos.';
    END IF;

    v_subcuenta_cliente := COALESCE(
        v_tutor.cuentas_contables->>'cliente',
        v_tutor.cuentas_contables->>'cuenta_cliente',
        v_tutor.cuentas_contables->>'cuenta'
    );

    IF v_subcuenta_cliente IS NULL OR TRIM(v_subcuenta_cliente) = '' THEN
        RAISE EXCEPTION 'El tutor seleccionado no cuenta con una subcuenta contable de cliente registrada en su JSON cuentas_contables.';
    END IF;

    v_codigo_anticipo_calculado := '438' || SUBSTRING(v_subcuenta_cliente FROM 4);

    -- 4. Insertar cobro en contabilidad_movimientos
    INSERT INTO contabilidad_movimientos (
        entidad_id, usuario_id, tipo, importe_total, moneda,
        medio_pago, tipo_servicio, fecha, concepto, estado, movimiento_banco_id, expediente_id
    ) VALUES (
        p_entidad_id, p_usuario_id, 'cobro', v_importe_numerico, 'EUR',
        'banco', 'viaje_estudios', v_fecha_movimiento,
        'Cobro a cuenta ' || v_tutor.nombre || ' - Exp: ' || v_expediente.referencia,
        'confirmado', p_movimiento_banco_id, p_expediente_id
    )
    RETURNING id INTO v_nuevo_movimiento_id;

    -- 5. Generar apuntes contables 572 D / 438 H si procede
    IF v_se_deben_generar_apuntes THEN
        SELECT id INTO v_cta_banco_id    FROM config_cuentas_contables WHERE codigo = '572';
        SELECT id INTO v_cta_anticipo_id FROM config_cuentas_contables WHERE codigo = '438';

        IF v_cta_banco_id IS NULL OR v_cta_anticipo_id IS NULL THEN
            RAISE EXCEPTION 'Descuadrado: Asegúrate de que el código 572 y el 438 existan en config_cuentas_contables.';
        END IF;

        SELECT cuenta_contable INTO v_subcuenta_banco
        FROM config_cuentas_bancarias
        WHERE id = v_mov_banco.cuenta_bancaria_id;

        v_subcuenta_banco   := COALESCE(v_subcuenta_banco, '572');
        v_concepto_banco    := 'Conciliación cobro ' || v_tutor.nombre || ' - Ref: ' || SUBSTRING(COALESCE(v_mov_banco.concepto_limpio, v_mov_banco.concepto_original, '') FROM 1 FOR 40);
        v_concepto_anticipo := 'Anticipo viaje ' || v_expediente.referencia || ' - ' || v_tutor.nombre;

        INSERT INTO contabilidad_apuntes (
            asiento_id, fecha, cuenta_id, entidad_id, debe, haber, concepto, subcuenta
        ) VALUES (
            NULL, v_fecha_movimiento, v_cta_banco_id, p_entidad_id,
            v_importe_numerico, 0, v_concepto_banco, v_subcuenta_banco
        )
        RETURNING id INTO v_apunte_id;

        INSERT INTO contabilidad_apuntes (
            asiento_id, fecha, cuenta_id, entidad_id, debe, haber, concepto, subcuenta
        ) VALUES (
            NULL, v_fecha_movimiento, v_cta_anticipo_id, p_entidad_id,
            0, v_importe_numerico, v_concepto_anticipo, v_codigo_anticipo_calculado
        );
    END IF;

    -- 6. Marcar movimiento bancario como conciliado
    -- Nota: movimiento_id no existe en esta tabla; el vínculo inverso es
    -- contabilidad_movimientos.movimiento_banco_id → contabilidad_movimientos_banco.id
    IF v_mov_banco.match_score IS NOT NULL AND v_mov_banco.match_score >= 70 THEN
        v_tipo_conciliacion := 'automatica';
    ELSE
        v_tipo_conciliacion := 'manual';
    END IF;

    UPDATE contabilidad_movimientos_banco
    SET
        estado            = 'conciliado',
        conciliacion_tipo = v_tipo_conciliacion,
        conciliado_at     = NOW(),
        conciliado_por    = p_usuario_id,
        apunte_id         = v_apunte_id
    WHERE id = p_movimiento_banco_id;

    -- 7. Actualizar saldo del pagador
    SELECT id, importe_abonado, importe_total, cuenta_bancaria
    INTO v_balance_pagador
    FROM operativa_pagadores_expedientes
    WHERE expediente_id = p_expediente_id
      AND entidad_id    = p_entidad_id
    FOR UPDATE;

    IF FOUND THEN
        v_acumulado_actualizado := v_balance_pagador.importe_abonado + v_importe_numerico;

        IF v_acumulado_actualizado >= v_balance_pagador.importe_total THEN
            v_estado_cobro_final := 'completado';
        ELSE
            v_estado_cobro_final := 'parcial';
        END IF;

        UPDATE operativa_pagadores_expedientes
        SET
            importe_abonado = v_acumulado_actualizado,
            estado          = v_estado_cobro_final,
            cuenta_bancaria = COALESCE(v_mov_banco.origen, v_balance_pagador.cuenta_bancaria),
            updated_at      = NOW()
        WHERE id = v_balance_pagador.id;
    END IF;

    v_response := jsonb_build_object(
        'success',           TRUE,
        'movimientoId',      v_nuevo_movimiento_id,
        'apuntesGenerados',  v_se_deben_generar_apuntes
    );

    RETURN v_response;
END;
$function$;
-- ============================================================
-- MIGRACIÓN: Tabla comunicaciones_expediente
-- Fecha: 2026-06-09
-- Objetivo: Registrar todos los emails enviados desde un expediente,
--   incluyendo destinatarios, asunto, cuerpo, adjuntos y estado.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.comunicaciones_expediente (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id   UUID REFERENCES operativa_expedientes(id) ON DELETE CASCADE,
    cotizacion_id   UUID REFERENCES operativa_cotizaciones(id) ON DELETE SET NULL,
    agente_id       TEXT NOT NULL,
    canal           VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (canal IN ('email', 'whatsapp', 'sms', 'nota')),
    asunto          TEXT,
    cuerpo          TEXT NOT NULL,
    destinatarios   JSONB NOT NULL DEFAULT '[]',
    adjuntos        JSONB NOT NULL DEFAULT '[]',
    estado          VARCHAR(20) NOT NULL DEFAULT 'enviado' CHECK (estado IN ('enviado', 'error', 'parcial')),
    error_detalle   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.comunicaciones_expediente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso total autenticados" ON public.comunicaciones_expediente
    FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_comunicaciones_expediente_id
    ON public.comunicaciones_expediente(expediente_id);

CREATE INDEX IF NOT EXISTS idx_comunicaciones_cotizacion_id
    ON public.comunicaciones_expediente(cotizacion_id);

CREATE INDEX IF NOT EXISTS idx_comunicaciones_agente_id
    ON public.comunicaciones_expediente(agente_id);

CREATE INDEX IF NOT EXISTS idx_comunicaciones_created_at
    ON public.comunicaciones_expediente(created_at DESC);

-- Destinatarios individuales con tracking por persona
CREATE TABLE IF NOT EXISTS public.comunicaciones_destinatarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comunicacion_id UUID NOT NULL REFERENCES comunicaciones_expediente(id) ON DELETE CASCADE,
    contacto_key    TEXT NOT NULL,
    rol             VARCHAR(10) NOT NULL CHECK (rol IN ('pagador', 'viajero')),
    nombre          TEXT NOT NULL,
    email           TEXT,
    telefono        TEXT,
    token           UUID NOT NULL DEFAULT gen_random_uuid(),
    estado          VARCHAR(20) NOT NULL DEFAULT 'enviado' CHECK (estado IN ('enviado', 'error', 'entregado', 'abierto')),
    error_detalle   TEXT,
    entregado_at    TIMESTAMP WITH TIME ZONE,
    abierto_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.comunicaciones_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso total autenticados" ON public.comunicaciones_destinatarios
    FOR ALL USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comunicaciones_dest_token
    ON public.comunicaciones_destinatarios(token);

CREATE INDEX IF NOT EXISTS idx_comunicaciones_dest_comunicacion_id
    ON public.comunicaciones_destinatarios(comunicacion_id);

-- ─── Propuestas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.operativa_propuestas (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id      text,
    title         text,
    destination   text,
    proposal_data jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operativa_propuestas_quote_id
    ON public.operativa_propuestas(quote_id);

ALTER TABLE public.operativa_propuestas ADD COLUMN IF NOT EXISTS cotizacion_id UUID REFERENCES public.operativa_cotizaciones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_propuestas_cotizacion_id ON public.operativa_propuestas(cotizacion_id);

ALTER TABLE public.operativa_propuestas ADD COLUMN IF NOT EXISTS contacto_id UUID REFERENCES public.contabilidad_entidades(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_propuestas_contacto_id ON public.operativa_propuestas(contacto_id);

-- Creador directo de la propuesta (independiente de si tiene cotización vinculada).
-- Sin FK: igual que operativa_cotizaciones.agente_id, guarda el auth_user_id de
-- Supabase Auth, que vive en un proyecto/BD separado, no un id de tabla local.
ALTER TABLE public.operativa_propuestas ADD COLUMN IF NOT EXISTS agente_id UUID;
CREATE INDEX IF NOT EXISTS idx_propuestas_agente_id ON public.operativa_propuestas(agente_id);

-- ─── Landings (1:N con propuestas) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.landings (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id    uuid NOT NULL REFERENCES public.operativa_propuestas(id) ON DELETE CASCADE,
    version_number integer NOT NULL DEFAULT 1,
    is_active      boolean NOT NULL DEFAULT false,
    design_tokens  jsonb NOT NULL DEFAULT '{}'::jsonb,
    editor_content jsonb NOT NULL DEFAULT '{}'::jsonb,
    html_sections  jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- Migration: add editor_content column to existing landings tables
ALTER TABLE public.landings ADD COLUMN IF NOT EXISTS editor_content jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_landings_proposal_id
    ON public.landings(proposal_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_landings_proposal_version
    ON public.landings(proposal_id, version_number);

-- Solo una landing activa por propuesta
CREATE UNIQUE INDEX IF NOT EXISTS idx_landings_proposal_active
    ON public.landings(proposal_id) WHERE (is_active = true);

GRANT ALL ON public.landings TO anon, authenticated, service_role;
ALTER TABLE public.landings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.landings FOR ALL TO service_role USING (true);

-- Favorites table for proposal sections
CREATE TABLE IF NOT EXISTS public.operativa_propuestas_favoritos (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    section_type text NOT NULL,
    name         text NOT NULL,
    content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    style_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.operativa_propuestas_favoritos TO anon, authenticated, service_role;
ALTER TABLE public.operativa_propuestas_favoritos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.operativa_propuestas_favoritos FOR ALL TO service_role USING (true);

-- ============================================================
-- MÓDULO CRM: CAMPAÑAS Y OPORTUNIDADES
-- Añadido: 2026-06-22
-- ============================================================

-- ------------------------------------------------------------
-- 1. MODIFICACIONES A TABLAS EXISTENTES
-- ------------------------------------------------------------

ALTER TABLE contabilidad_entidades
    ADD COLUMN IF NOT EXISTS tipo_entidad VARCHAR(20)
        DEFAULT 'persona'
        CHECK (tipo_entidad IN ('persona', 'organizacion', 'empresa'));

ALTER TABLE operativa_expedientes
    ADD COLUMN IF NOT EXISTS oportunidad_id UUID;

-- ------------------------------------------------------------
-- 2. ESPEJO DE AGENTES (sincronizado desde BD Admin via Edge Function)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_agentes (
    id          UUID PRIMARY KEY,
    auth_uid    UUID UNIQUE NOT NULL,
    nombre      VARCHAR(255) NOT NULL,
    apellidos   VARCHAR(100),
    avatar_url  TEXT,
    rol         VARCHAR(20) NOT NULL CHECK (rol IN ('Agente', 'Admin', 'SuperAdmin', 'Owner', 'Contable')),
    activo      BOOLEAN NOT NULL DEFAULT true,
    synced_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_agentes_auth_uid ON crm_agentes(auth_uid);
CREATE INDEX IF NOT EXISTS idx_crm_agentes_activo   ON crm_agentes(activo);

-- Agente asignado al cliente/entidad (de momento todas NULL, asignación manual)
ALTER TABLE contabilidad_entidades
  ADD COLUMN IF NOT EXISTS agente_id UUID REFERENCES crm_agentes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_entidades_agente ON contabilidad_entidades(agente_id);

-- Etiquetas para clientes/entidades.
-- Toda etiqueta pertenece a su creador (agente_id) y a la sucursal de este en el
-- momento de crearla (oficina_id). La visibilidad no se decide al crear, sino al
-- LISTAR: quien consulta elige ver solo las suyas, las de su sucursal, o todas.
CREATE TABLE IF NOT EXISTS crm_etiquetas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      VARCHAR(60) NOT NULL,
    color       VARCHAR(20) NOT NULL DEFAULT '#64748b',
    oficina_id  UUID REFERENCES config_oficinas(id) ON DELETE CASCADE,
    agente_id   UUID NOT NULL REFERENCES crm_agentes(id) ON DELETE CASCADE,
    created_by  UUID REFERENCES crm_agentes(id) ON DELETE SET NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_etiquetas_oficina ON crm_etiquetas(oficina_id);
CREATE INDEX IF NOT EXISTS idx_crm_etiquetas_agente  ON crm_etiquetas(agente_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_etiquetas_uniq_nombre_agente
    ON crm_etiquetas(nombre, agente_id);

CREATE TABLE IF NOT EXISTS crm_entidades_etiquetas (
    entidad_id   UUID NOT NULL REFERENCES contabilidad_entidades(id) ON DELETE CASCADE,
    etiqueta_id  UUID NOT NULL REFERENCES crm_etiquetas(id) ON DELETE CASCADE,
    added_by     UUID REFERENCES crm_agentes(id) ON DELETE SET NULL,
    added_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (entidad_id, etiqueta_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_entidades_etiquetas_etiqueta ON crm_entidades_etiquetas(etiqueta_id);

-- ------------------------------------------------------------
-- 3. CAMPAÑAS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_campanas (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre       VARCHAR(255) NOT NULL,
    descripcion  TEXT,
    tipo         VARCHAR(100),
    estado       VARCHAR(20) NOT NULL DEFAULT 'planificada'
                     CHECK (estado IN ('planificada', 'activa', 'pausada', 'finalizada')),
    fecha_inicio DATE,
    fecha_fin    DATE,
    oficina_id   UUID REFERENCES config_oficinas(id) ON DELETE SET NULL,
    created_by   UUID REFERENCES crm_agentes(id) ON DELETE SET NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_campanas_estado     ON crm_campanas(estado);
CREATE INDEX IF NOT EXISTS idx_crm_campanas_created_by ON crm_campanas(created_by);

ALTER TABLE public.crm_campanas
  ADD COLUMN IF NOT EXISTS configuracion_pipeline JSONB NOT NULL DEFAULT '{}'::jsonb;

DROP TRIGGER IF EXISTS trg_crm_campanas_updated ON crm_campanas;
CREATE TRIGGER trg_crm_campanas_updated
    BEFORE UPDATE ON crm_campanas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 4. ESTADOS DINÁMICOS DE CAMPAÑA
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_campanas_estados (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campana_id  UUID NOT NULL REFERENCES crm_campanas(id) ON DELETE CASCADE,
    nombre      VARCHAR(100) NOT NULL,
    orden       INTEGER NOT NULL DEFAULT 0,
    color       VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    es_final    BOOLEAN NOT NULL DEFAULT false,
    es_ganado   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (campana_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_crm_campanas_estados_campana ON crm_campanas_estados(campana_id);

-- ------------------------------------------------------------
-- 5. AGENTES ASIGNADOS A CAMPAÑA (con objetivos)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_campanas_agentes (
    campana_id      UUID NOT NULL REFERENCES crm_campanas(id) ON DELETE CASCADE,
    agente_id       UUID NOT NULL REFERENCES crm_agentes(id) ON DELETE CASCADE,
    rol             VARCHAR(20) NOT NULL DEFAULT 'colaborador'
                        CHECK (rol IN ('lider', 'colaborador')),
    objetivo_num    INTEGER,
    objetivo_valor  NUMERIC(12,2),
    added_by        UUID REFERENCES crm_agentes(id) ON DELETE SET NULL,
    added_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (campana_id, agente_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_campanas_agentes_agente ON crm_campanas_agentes(agente_id);

-- ------------------------------------------------------------
-- 6. CONTACTOS CRM
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_contactos (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidad_id   UUID REFERENCES contabilidad_entidades(id) ON DELETE SET NULL,
    nombre       VARCHAR(255) NOT NULL,
    cargo        VARCHAR(100),
    email        VARCHAR(255),
    telefono     VARCHAR(20),
    es_principal BOOLEAN NOT NULL DEFAULT false,
    activo       BOOLEAN NOT NULL DEFAULT true,
    metadatos    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_contactos_entidad ON crm_contactos(entidad_id);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_email   ON crm_contactos(email);

DROP TRIGGER IF EXISTS trg_crm_contactos_updated ON crm_contactos;
CREATE TRIGGER trg_crm_contactos_updated
    BEFORE UPDATE ON crm_contactos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 7. HISTORIAL DE CAMBIOS DE ORGANIZACIÓN DE CONTACTO
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_contactos_organizaciones (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contacto_id  UUID NOT NULL REFERENCES crm_contactos(id) ON DELETE CASCADE,
    entidad_id   UUID NOT NULL REFERENCES contabilidad_entidades(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin    DATE,
    es_activa    BOOLEAN NOT NULL DEFAULT true,
    motivo       TEXT,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_cont_org_contacto ON crm_contactos_organizaciones(contacto_id);
CREATE INDEX IF NOT EXISTS idx_crm_cont_org_activa   ON crm_contactos_organizaciones(contacto_id) WHERE es_activa = true;

-- Un contacto puede estar vinculado a varias entidades a la vez (relación N:M libre).
-- Evita duplicar la misma relación contacto-entidad.
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_cont_org_uniq
    ON crm_contactos_organizaciones(contacto_id, entidad_id);

-- ------------------------------------------------------------
-- 8. OPORTUNIDADES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_oportunidades (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo            VARCHAR(255) NOT NULL,
    descripcion       TEXT,
    campana_id        UUID NOT NULL REFERENCES crm_campanas(id) ON DELETE RESTRICT,
    entidad_id        UUID REFERENCES contabilidad_entidades(id) ON DELETE SET NULL,
    contacto_id       UUID REFERENCES crm_contactos(id) ON DELETE SET NULL,
    agente_id         UUID REFERENCES crm_agentes(id) ON DELETE SET NULL,
    estado_id         UUID REFERENCES crm_campanas_estados(id) ON DELETE RESTRICT,
    valor_estimado    NUMERIC(12,2) NOT NULL DEFAULT 0,
    fecha_cierre_est  DATE,
    origen            VARCHAR(20) NOT NULL DEFAULT 'agente'
                          CHECK (origen IN ('agente', 'admin', 'importacion', 'web')),
    expediente_id     UUID REFERENCES operativa_expedientes(id) ON DELETE SET NULL,
    convertida_at     TIMESTAMP WITH TIME ZONE,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_oport_campana        ON crm_oportunidades(campana_id);
CREATE INDEX IF NOT EXISTS idx_crm_oport_campana_estado ON crm_oportunidades(campana_id, estado_id);
CREATE INDEX IF NOT EXISTS idx_crm_oport_agente         ON crm_oportunidades(agente_id);
CREATE INDEX IF NOT EXISTS idx_crm_oport_entidad        ON crm_oportunidades(entidad_id);
CREATE INDEX IF NOT EXISTS idx_crm_oport_expediente     ON crm_oportunidades(expediente_id);


DROP TRIGGER IF EXISTS trg_crm_oportunidades_updated ON crm_oportunidades;
CREATE TRIGGER trg_crm_oportunidades_updated
    BEFORE UPDATE ON crm_oportunidades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- FK diferida: operativa_expedientes.oportunidad_id → crm_oportunidades
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_expedientes_oportunidad'
    ) THEN
        ALTER TABLE operativa_expedientes
            ADD CONSTRAINT fk_expedientes_oportunidad
            FOREIGN KEY (oportunidad_id) REFERENCES crm_oportunidades(id) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_expedientes_oportunidad ON operativa_expedientes(oportunidad_id);

-- ------------------------------------------------------------
-- 9. LOG DE HISTORIAL DE ESTADOS DE OPORTUNIDAD
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_oportunidades_estados_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oportunidad_id      UUID NOT NULL REFERENCES crm_oportunidades(id) ON DELETE CASCADE,
    estado_anterior_id  UUID REFERENCES crm_campanas_estados(id) ON DELETE SET NULL,
    estado_nuevo_id     UUID NOT NULL REFERENCES crm_campanas_estados(id) ON DELETE RESTRICT,
    cambiado_por        UUID REFERENCES crm_agentes(id) ON DELETE SET NULL,
    notas               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_estados_log_oportunidad ON crm_oportunidades_estados_log(oportunidad_id);
CREATE INDEX IF NOT EXISTS idx_crm_estados_log_fecha       ON crm_oportunidades_estados_log(created_at DESC);

-- Trigger automático: registra cambio de estado + quién lo hizo via variable de sesión
CREATE OR REPLACE FUNCTION fn_crm_log_cambio_estado()
RETURNS TRIGGER AS $$
DECLARE
    v_agente_id UUID;
BEGIN
    IF (TG_OP = 'INSERT') OR (OLD.estado_id IS DISTINCT FROM NEW.estado_id) THEN
        -- El agente que hace el cambio se pasa via: SET LOCAL app.current_agent_id = 'uuid'
        BEGIN
            v_agente_id := current_setting('app.current_agent_id', true)::uuid;
        EXCEPTION WHEN others THEN
            v_agente_id := NEW.agente_id;
        END;

        INSERT INTO crm_oportunidades_estados_log (
            oportunidad_id,
            estado_anterior_id,
            estado_nuevo_id,
            cambiado_por,
            notas
        ) VALUES (
            NEW.id,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.estado_id END,
            NEW.estado_id,
            v_agente_id,
            NULL
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_crm_oportunidades_log_estado ON crm_oportunidades;
CREATE TRIGGER tr_crm_oportunidades_log_estado
    AFTER INSERT OR UPDATE OF estado_id ON crm_oportunidades
    FOR EACH ROW EXECUTE FUNCTION fn_crm_log_cambio_estado();

-- ------------------------------------------------------------
-- 10. FUNCIÓN HELPER DE ROL (para RLS)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION crm_get_current_agent_role()
RETURNS VARCHAR AS $$
    SELECT rol FROM crm_agentes WHERE auth_uid = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------
-- 11. RLS
-- ------------------------------------------------------------

ALTER TABLE crm_agentes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campanas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campanas_estados           ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campanas_agentes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contactos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contactos_organizaciones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_oportunidades              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_oportunidades_estados_log  ENABLE ROW LEVEL SECURITY;

-- crm_agentes: todos los autenticados pueden leer (necesario para mostrar nombres)
CREATE POLICY "crm_agentes_select" ON crm_agentes
    FOR SELECT TO authenticated USING (true);

-- crm_campanas: admin ve y crea todo; agente solo ve las suyas
CREATE POLICY "crm_campanas_select" ON crm_campanas
    FOR SELECT TO authenticated
    USING (
        crm_get_current_agent_role() IN ('Admin', 'SuperAdmin', 'Owner')
        OR EXISTS (
            SELECT 1 FROM crm_campanas_agentes ca
            JOIN crm_agentes ag ON ag.id = ca.agente_id
            WHERE ca.campana_id = crm_campanas.id
              AND ag.auth_uid = auth.uid()
        )
    );

CREATE POLICY "crm_campanas_insert" ON crm_campanas
    FOR INSERT TO authenticated
    WITH CHECK (crm_get_current_agent_role() IN ('Admin', 'SuperAdmin', 'Owner'));

CREATE POLICY "crm_campanas_update" ON crm_campanas
    FOR UPDATE TO authenticated
    USING (crm_get_current_agent_role() IN ('Admin', 'SuperAdmin', 'Owner'));

CREATE POLICY "crm_campanas_delete" ON crm_campanas
    FOR DELETE TO authenticated
    USING (crm_get_current_agent_role() IN ('Admin', 'SuperAdmin', 'Owner'));

-- crm_campanas_estados: misma lógica que campañas
CREATE POLICY "crm_campanas_estados_select" ON crm_campanas_estados
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_campanas_estados_insert" ON crm_campanas_estados
    FOR INSERT TO authenticated
    WITH CHECK (crm_get_current_agent_role() IN ('Admin', 'SuperAdmin', 'Owner'));

CREATE POLICY "crm_campanas_estados_update" ON crm_campanas_estados
    FOR UPDATE TO authenticated
    USING (crm_get_current_agent_role() IN ('Admin', 'SuperAdmin', 'Owner'));

CREATE POLICY "crm_campanas_estados_delete" ON crm_campanas_estados
    FOR DELETE TO authenticated
    USING (crm_get_current_agent_role() IN ('Admin', 'SuperAdmin', 'Owner'));

-- crm_campanas_agentes
CREATE POLICY "crm_campanas_agentes_select" ON crm_campanas_agentes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_campanas_agentes_insert" ON crm_campanas_agentes
    FOR INSERT TO authenticated
    WITH CHECK (crm_get_current_agent_role() IN ('Admin', 'SuperAdmin', 'Owner'));

CREATE POLICY "crm_campanas_agentes_update" ON crm_campanas_agentes
    FOR UPDATE TO authenticated
    USING (crm_get_current_agent_role() IN ('Admin', 'SuperAdmin', 'Owner'));

CREATE POLICY "crm_campanas_agentes_delete" ON crm_campanas_agentes
    FOR DELETE TO authenticated
    USING (crm_get_current_agent_role() IN ('Admin', 'SuperAdmin', 'Owner'));

-- crm_contactos: todos leen, todos insertan/editan
CREATE POLICY "crm_contactos_select" ON crm_contactos
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_contactos_insert" ON crm_contactos
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "crm_contactos_update" ON crm_contactos
    FOR UPDATE TO authenticated USING (true);

-- crm_contactos_organizaciones
CREATE POLICY "crm_cont_org_select" ON crm_contactos_organizaciones
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_cont_org_insert" ON crm_contactos_organizaciones
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "crm_cont_org_update" ON crm_contactos_organizaciones
    FOR UPDATE TO authenticated USING (true);

-- crm_oportunidades: admin ve todo; agente solo las suyas
CREATE POLICY "crm_oportunidades_select" ON crm_oportunidades
    FOR SELECT TO authenticated
    USING (
        crm_get_current_agent_role() IN ('Admin', 'SuperAdmin', 'Owner')
        OR agente_id = (SELECT id FROM crm_agentes WHERE auth_uid = auth.uid())
    );

CREATE POLICY "crm_oportunidades_insert" ON crm_oportunidades
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "crm_oportunidades_update" ON crm_oportunidades
    FOR UPDATE TO authenticated
    USING (
        crm_get_current_agent_role() IN ('Admin', 'SuperAdmin', 'Owner')
        OR agente_id = (SELECT id FROM crm_agentes WHERE auth_uid = auth.uid())
    );

CREATE POLICY "crm_oportunidades_delete" ON crm_oportunidades
    FOR DELETE TO authenticated
    USING (crm_get_current_agent_role() IN ('Admin', 'SuperAdmin', 'Owner'));

-- crm_oportunidades_estados_log: solo lectura para todos
CREATE POLICY "crm_estados_log_select" ON crm_oportunidades_estados_log
    FOR SELECT TO authenticated USING (true);

-- El trigger inserta con SECURITY DEFINER implícito via la función fn_crm_log_cambio_estado
-- Para permitir inserts desde el trigger necesitamos policy permisiva para service_role:
CREATE POLICY "crm_estados_log_insert" ON crm_oportunidades_estados_log
    FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- BI CHAT: función de ejecución segura de consultas SELECT
-- Usada por el Copilot de Auditoría para responder preguntas
-- sobre los datos de la agencia en lenguaje natural.
-- ============================================================

CREATE OR REPLACE FUNCTION exec_bi_query(query_sql TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  IF query_sql !~* '^\s*(SELECT|WITH)\s' THEN
    RAISE EXCEPTION 'Solo se permiten consultas SELECT';
  END IF;

  IF query_sql ~* '\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE|COPY)\b' THEN
    RAISE EXCEPTION 'Consulta no permitida';
  END IF;

  -- Use EXECUTE directly with the sql string to avoid format() escaping issues
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_sql || ') t'
    INTO result;

  RETURN jsonb_build_object('rows', COALESCE(result, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION exec_bi_query(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exec_bi_query(TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Presupuestos (wizard 3 pasos)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tipo_presupuesto_enum AS ENUM ('vacacional', 'P2P', 'grupo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.operativa_presupuestos (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo_viaje           VARCHAR(255) NOT NULL,
    tipo_presupuesto       tipo_presupuesto_enum NOT NULL,
    plazas_estimadas       INT NOT NULL CHECK (plazas_estimadas > 0),
    destino_ids            UUID[]       DEFAULT '{}',
    fecha_salida_estimada  DATE,
    fecha_regreso_estimada DATE,
    pvp_estimado           DECIMAL(12,2),
    entidad_id             UUID REFERENCES public.contabilidad_entidades(id) ON DELETE SET NULL,
    agente_id              UUID NOT NULL,
    cotizacion_id          UUID REFERENCES public.operativa_cotizaciones(id) ON DELETE SET NULL,
    estado                 VARCHAR(50) NOT NULL DEFAULT 'pendiente_cotizar'
                               CHECK (estado IN ('borrador','pendiente_cotizar','cotizado','descartado')),
    preferencias           JSONB DEFAULT '{}'::jsonb,
    notas_iniciales        TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Columnas añadidas como parche si la tabla ya existía sin ellas
ALTER TABLE public.operativa_presupuestos ADD COLUMN IF NOT EXISTS preferencias           JSONB        DEFAULT '{}'::jsonb;
ALTER TABLE public.operativa_presupuestos ADD COLUMN IF NOT EXISTS destino_ids            UUID[]       DEFAULT '{}';
ALTER TABLE public.operativa_presupuestos ADD COLUMN IF NOT EXISTS fecha_regreso_estimada DATE;
ALTER TABLE public.operativa_presupuestos ADD COLUMN IF NOT EXISTS pvp_estimado           DECIMAL(12,2);
ALTER TABLE public.operativa_presupuestos ADD COLUMN IF NOT EXISTS notas_iniciales        TEXT;
ALTER TABLE public.operativa_presupuestos ADD COLUMN IF NOT EXISTS noches_estimadas       INT;
ALTER TABLE public.operativa_presupuestos ADD COLUMN IF NOT EXISTS margen_salida_dias     INT;
ALTER TABLE public.operativa_presupuestos ADD COLUMN IF NOT EXISTS margen_regreso_dias    INT;
ALTER TABLE public.operativa_presupuestos ADD COLUMN IF NOT EXISTS oportunidad_id         UUID REFERENCES public.crm_oportunidades(id) ON DELETE SET NULL;
ALTER TABLE public.operativa_presupuestos ADD COLUMN IF NOT EXISTS campana_id             UUID REFERENCES public.crm_campanas(id)      ON DELETE SET NULL;

-- Nuevo estado cotizando
ALTER TABLE public.operativa_presupuestos DROP CONSTRAINT IF EXISTS operativa_presupuestos_estado_check;
ALTER TABLE public.operativa_presupuestos ADD CONSTRAINT operativa_presupuestos_estado_check
    CHECK (estado IN ('borrador','pendiente_cotizar','cotizando','cotizado','descartado'));

CREATE INDEX IF NOT EXISTS idx_presupuestos_tipo         ON public.operativa_presupuestos(tipo_presupuesto);
CREATE INDEX IF NOT EXISTS idx_presupuestos_agente  ON public.operativa_presupuestos(agente_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado  ON public.operativa_presupuestos(estado);
CREATE INDEX IF NOT EXISTS idx_presupuestos_entidad ON public.operativa_presupuestos(entidad_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_pref         ON public.operativa_presupuestos USING GIN(preferencias);
CREATE INDEX IF NOT EXISTS idx_presupuestos_oportunidad  ON public.operativa_presupuestos(oportunidad_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_campana      ON public.operativa_presupuestos(campana_id);

ALTER TABLE operativa_cotizaciones ADD COLUMN IF NOT EXISTS presupuesto_id UUID REFERENCES public.operativa_presupuestos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_presupuesto_id ON operativa_cotizaciones(presupuesto_id);

ALTER TABLE public.comunicaciones_expediente ADD COLUMN IF NOT EXISTS propuesta_id UUID REFERENCES public.operativa_propuestas(id) ON DELETE SET NULL;
ALTER TABLE public.comunicaciones_expediente ADD COLUMN IF NOT EXISTS presupuesto_id UUID REFERENCES public.operativa_presupuestos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comunicaciones_propuesta_id
    ON public.comunicaciones_expediente(propuesta_id);

CREATE INDEX IF NOT EXISTS idx_comunicaciones_presupuesto_id
    ON public.comunicaciones_expediente(presupuesto_id);

CREATE OR REPLACE FUNCTION fn_presupuestos_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = TIMEZONE('utc', NOW()); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_presupuestos_updated ON public.operativa_presupuestos;
CREATE TRIGGER trg_presupuestos_updated
    BEFORE UPDATE ON public.operativa_presupuestos
    FOR EACH ROW EXECUTE FUNCTION fn_presupuestos_updated();

ALTER TABLE public.operativa_presupuestos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "presupuestos_all" ON public.operativa_presupuestos;
CREATE POLICY "presupuestos_all" ON public.operativa_presupuestos
    USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.operativa_presupuesto_contactos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presupuesto_id  UUID NOT NULL REFERENCES public.operativa_presupuestos(id) ON DELETE CASCADE,
    crm_contacto_id UUID REFERENCES public.crm_contactos(id) ON DELETE SET NULL,
    nombre          VARCHAR(255) NOT NULL,
    apellidos       VARCHAR(255),
    cargo           VARCHAR(255),
    email           VARCHAR(255),
    telefono        VARCHAR(50),
    es_principal    BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.operativa_presupuesto_contactos
    ADD COLUMN IF NOT EXISTS crm_contacto_id UUID REFERENCES public.crm_contactos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pres_contactos_presupuesto ON public.operativa_presupuesto_contactos(presupuesto_id);

ALTER TABLE public.operativa_presupuesto_contactos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pres_contactos_all" ON public.operativa_presupuesto_contactos;
CREATE POLICY "pres_contactos_all" ON public.operativa_presupuesto_contactos
    FOR ALL USING (true);

-- ------------------------------------------------------------
-- VALORACIONES DE SERVICIOS (satisfacción del cliente)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.valoraciones_encuestas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id   UUID NOT NULL REFERENCES public.operativa_expedientes(id) ON DELETE CASCADE,
    token           UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    servicios_ids   UUID[] NOT NULL DEFAULT '{}',   -- lineas seleccionadas para valorar
    enviado_a       TEXT,                            -- email del destinatario
    enviado_at      TIMESTAMPTZ,
    completado_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.valoraciones_servicios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encuesta_id     UUID NOT NULL REFERENCES public.valoraciones_encuestas(id) ON DELETE CASCADE,
    linea_id        UUID NOT NULL,                   -- operativa_cotizacion_lineas.id
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comentario      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.valoraciones_encuestas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "valoraciones_encuestas_all" ON public.valoraciones_encuestas;
CREATE POLICY "valoraciones_encuestas_all" ON public.valoraciones_encuestas FOR ALL USING (true);

ALTER TABLE public.valoraciones_servicios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "valoraciones_servicios_all" ON public.valoraciones_servicios;
CREATE POLICY "valoraciones_servicios_all" ON public.valoraciones_servicios FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_val_encuestas_expediente ON public.valoraciones_encuestas(expediente_id);
CREATE INDEX IF NOT EXISTS idx_val_encuestas_token ON public.valoraciones_encuestas(token);
CREATE INDEX IF NOT EXISTS idx_val_servicios_encuesta ON public.valoraciones_servicios(encuesta_id);
CREATE INDEX IF NOT EXISTS idx_val_servicios_linea ON public.valoraciones_servicios(linea_id);


-- ============================================================
-- ANALÍTICA: MÉTRICAS DE COTIZACIONES (tabla en BD Admin)
-- Sin datos de agencia ni cliente — solo tendencias macro
-- ============================================================

-- EJECUTAR EN LA BD ADMIN (donde están agencias y usuarios)
CREATE TABLE IF NOT EXISTS public.metricas_cotizaciones (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lat             NUMERIC(10,8) NOT NULL,
    lng             NUMERIC(11,8) NOT NULL,
    destino_nombre  TEXT,
    mes_viaje       DATE NOT NULL,
    total_plazas    INTEGER NOT NULL DEFAULT 1,
    tipo_grupo      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.metricas_cotizaciones ADD COLUMN IF NOT EXISTS localidad TEXT;
ALTER TABLE public.metricas_cotizaciones ADD COLUMN IF NOT EXISTS provincia TEXT;

CREATE INDEX IF NOT EXISTS idx_metricas_mes      ON public.metricas_cotizaciones(mes_viaje);
CREATE INDEX IF NOT EXISTS idx_metricas_tipo     ON public.metricas_cotizaciones(tipo_grupo);
CREATE INDEX IF NOT EXISTS idx_metricas_latng    ON public.metricas_cotizaciones(lat, lng);
CREATE INDEX IF NOT EXISTS idx_metricas_localidad ON public.metricas_cotizaciones(localidad);


-- ============================================================
-- PROPUESTAS: SECCIONES FAVORITAS POR USUARIO
-- Ejecutar en la BD de cada agencia
-- ============================================================

-- Favoritos a nivel de agencia: fav_id es único en toda la tabla (no por
-- usuario), así cualquier agente puede ver/usar/borrar los favoritos de
-- toda la agencia. usuario_id se conserva solo como registro de autoría.
CREATE TABLE IF NOT EXISTS public.propuestas_secciones_favoritas (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   UUID NOT NULL,
    fav_id       TEXT NOT NULL,
    seccion_data JSONB NOT NULL,
    saved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (fav_id)
);

CREATE INDEX IF NOT EXISTS idx_propuestas_fav_usuario ON public.propuestas_secciones_favoritas(usuario_id);


-- ============================================================
-- MIGRACIÓN PARA MÓDULOS Y PARÁMETROS DE TENANT
-- ============================================================

-- 1. Capa 1: Configuración de Módulos (En la Base de Datos del Tenant/Agency)
CREATE TABLE IF NOT EXISTS public.config_modulos_tenant (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    radar_activo          BOOLEAN NOT NULL DEFAULT true,   -- Módulo 1: RADAR (CRM)
    studio_activo         BOOLEAN NOT NULL DEFAULT true,   -- Módulo 2: STUDIO (Propuestas)
    core_activo           BOOLEAN NOT NULL DEFAULT true,   -- Módulo 3: CORE (Expedientes)
    pulse_activo          BOOLEAN NOT NULL DEFAULT false,  -- Módulo 4: PULSE (Fidelización)
    ledger_tax_activo     BOOLEAN NOT NULL DEFAULT false,  -- Módulo 5: LEDGER (Contabilidad/IVA)
    ocultar_crm           BOOLEAN NOT NULL DEFAULT false,
    ocultar_contabilidad  BOOLEAN NOT NULL DEFAULT false,
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar registro por defecto si no existe ninguno
INSERT INTO public.config_modulos_tenant (radar_activo, studio_activo, core_activo, pulse_activo, ledger_tax_activo)
SELECT true, true, true, false, false
WHERE NOT EXISTS (SELECT 1 FROM public.config_modulos_tenant);

-- 2. Capa 2: Parámetros del Tenant y Permisos Granulares
CREATE TABLE IF NOT EXISTS public.config_parametros_tenant (
    id                                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_tenant                             VARCHAR(20) NOT NULL DEFAULT 'agencia' CHECK (tipo_tenant IN ('agencia', 'mayorista')),
    compartir_datos_oficinas                BOOLEAN NOT NULL DEFAULT false,
    alcance_vista_agentes                   VARCHAR(20) NOT NULL DEFAULT 'subtenant' CHECK (alcance_vista_agentes IN ('propio', 'subtenant', 'tenant')),
    permisos_radar_oportunidades            JSONB NOT NULL DEFAULT '{"crear": true, "editar": true, "borrar": false}'::jsonb,
    permisos_studio_proveedores             JSONB NOT NULL DEFAULT '{"crear": true, "editar": true, "borrar": true}'::jsonb,
    permisos_studio_clientes                JSONB NOT NULL DEFAULT '{"crear": true, "editar": true, "borrar": false}'::jsonb,
    permisos_core_expedientes               JSONB NOT NULL DEFAULT '{"crear": true, "editar": true, "borrar": false}'::jsonb,
    permisos_core_pasajeros                 JSONB NOT NULL DEFAULT '{"crear": true, "editar": true, "borrar": false}'::jsonb,
    permisos_pulse_campanas                 JSONB NOT NULL DEFAULT '{"crear": true, "editar": true, "borrar": false}'::jsonb,
    updated_at                              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar configuración por defecto si no existe ninguna
INSERT INTO public.config_parametros_tenant (tipo_tenant, compartir_datos_oficinas)
SELECT 'agencia', false
WHERE NOT EXISTS (SELECT 1 FROM public.config_parametros_tenant);

-- 3. Vincular Proveedor a la tabla config_oficinas
ALTER TABLE public.config_oficinas
ADD COLUMN IF NOT EXISTS proveedor_id TEXT REFERENCES public.contabilidad_proveedores(id) ON DELETE SET NULL;

-- ============================================================
-- Tabla puente servicios <-> pagos (registrar pago desde expediente)
-- ============================================================
-- Tabla puente explícita entre servicios del expediente y pagos (contabilidad_movimientos).
-- Sustituye/complementa el matching vía JSONB (match_metadatos) para soportar pagos
-- directos en tarjeta/efectivo (sin movimiento_banco_id) además de los conciliados por banco.
CREATE TABLE IF NOT EXISTS public.operativa_servicio_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id UUID NOT NULL REFERENCES public.operativa_expedientes_servicios(id) ON DELETE CASCADE,
  movimiento_id UUID NOT NULL REFERENCES public.contabilidad_movimientos(id) ON DELETE CASCADE,
  importe NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_servicio_pagos_servicio ON public.operativa_servicio_pagos(servicio_id);
CREATE INDEX IF NOT EXISTS idx_servicio_pagos_movimiento ON public.operativa_servicio_pagos(movimiento_id);

-- Vista de importes abonados por servicio: ahora combina el matching histórico vía banco
-- (direct/grouped/desde_documento, sin cambios) con la nueva tabla puente, que es la única
-- vía de registro para pagos en tarjeta/efectivo (movimiento_banco_id IS NULL).
CREATE OR REPLACE VIEW public.v_abonados_servicios AS
WITH direct AS (
  SELECT (cmb.match_metadatos->>'servicio_id')::uuid AS servicio_id,
         cm.importe_total::numeric AS abonado
  FROM contabilidad_movimientos cm
  JOIN contabilidad_movimientos_banco cmb ON cmb.id = cm.movimiento_banco_id
  WHERE cm.tipo = 'pago'
    AND cm.estado = 'confirmado'
    AND cmb.match_metadatos ? 'servicio_id'
    AND cmb.match_metadatos->>'servicio_id' IS NOT NULL
    AND cmb.match_metadatos->>'servicio_id' != 'null'
),
grouped AS (
  SELECT (p.value->>'id')::uuid AS servicio_id,
         ABS((p.value->>'importe')::numeric) AS abonado
  FROM contabilidad_movimientos cm
  JOIN contabilidad_movimientos_banco cmb ON cmb.id = cm.movimiento_banco_id
  CROSS JOIN jsonb_array_elements(cmb.match_metadatos->'pagos') AS p(value)
  WHERE cm.tipo = 'pago'
    AND cm.estado = 'confirmado'
    AND (cmb.match_metadatos->>'origen') = 'servicio'
    AND cmb.match_metadatos ? 'pagos'
),
desde_documento AS (
  SELECT oes.id AS servicio_id,
         ABS((p.value->>'importe')::numeric) AS abonado
  FROM contabilidad_movimientos_banco cmb
  CROSS JOIN jsonb_array_elements(cmb.match_metadatos->'pagos') AS p(value)
  JOIN operativa_expedientes_servicios oes ON oes.documento_id = (p.value->>'documento_id')::uuid
  WHERE cmb.match_metadatos ? 'pagos'
    AND p.value ? 'documento_id'
    AND p.value->>'documento_id' IS NOT NULL
    AND p.value->>'documento_id' != 'null'
    AND (cmb.match_metadatos->>'origen' IS NULL OR cmb.match_metadatos->>'origen' != 'servicio')
    AND EXISTS (
      SELECT 1 FROM contabilidad_movimientos cm
      WHERE cm.movimiento_banco_id = cmb.id
        AND cm.tipo = 'pago'
        AND cm.estado = 'confirmado'
    )
),
directo_servicio_pagos AS (
  SELECT sp.servicio_id, sp.importe::numeric AS abonado
  FROM operativa_servicio_pagos sp
  JOIN contabilidad_movimientos cm ON cm.id = sp.movimiento_id
  WHERE cm.tipo = 'pago'
    AND cm.estado = 'confirmado'
),
combined AS (
  SELECT servicio_id, abonado FROM direct
  UNION ALL
  SELECT servicio_id, abonado FROM grouped
  UNION ALL
  SELECT servicio_id, abonado FROM desde_documento
  UNION ALL
  SELECT servicio_id, abonado FROM directo_servicio_pagos
)
SELECT servicio_id, SUM(abonado) AS total_abonado
FROM combined
WHERE servicio_id IS NOT NULL
GROUP BY servicio_id;

-- Añade el campo "noches" a los servicios del expediente, para mostrar/editar
-- el número de noches (p.ej. en alojamientos) junto a plazas en los listados de servicios.
ALTER TABLE public.operativa_expedientes_servicios
ADD COLUMN IF NOT EXISTS noches INTEGER;

-- Añade el destino como texto libre a los servicios del expediente
-- (sin FK a maestro_destinos: se edita como texto simple desde un modal).
-- Si la columna ya existe como UUID (versión anterior de esta migración),
-- se elimina y se recrea como TEXT.
ALTER TABLE public.operativa_expedientes_servicios
DROP COLUMN IF EXISTS destino;

ALTER TABLE public.operativa_expedientes_servicios
ADD COLUMN IF NOT EXISTS destino TEXT;

-- Añade el estado de confirmación a cada línea de cotización, para distinguir
-- entre servicios ya confirmados con el proveedor y pendientes de confirmar.
ALTER TABLE public.operativa_cotizacion_lineas
ADD COLUMN IF NOT EXISTS confirmado BOOLEAN NOT NULL DEFAULT false;

-- Revierte destino de vuelta a UUID (FK a maestro_destinos), para usar el mismo
-- selector con sincronización que la cotización (DestinationSelector).
ALTER TABLE public.operativa_expedientes_servicios
DROP COLUMN IF EXISTS destino;

ALTER TABLE public.operativa_expedientes_servicios
ADD COLUMN IF NOT EXISTS destino UUID REFERENCES public.maestro_destinos(id) ON DELETE SET NULL;

-- ─── Formatos de página (categorías libres creadas por el agente: Blog, Ofertas, Guías...) ──
CREATE TABLE IF NOT EXISTS public.paginas_web_formatos (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre     text NOT NULL,
    slug       text NOT NULL,
    color      text,
    icono      text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_paginas_web_formatos_slug ON public.paginas_web_formatos(slug);

GRANT ALL ON public.paginas_web_formatos TO anon, authenticated, service_role;
ALTER TABLE public.paginas_web_formatos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.paginas_web_formatos;
CREATE POLICY "service_role_all" ON public.paginas_web_formatos FOR ALL TO service_role USING (true);

-- ─── Páginas web de la agencia (mini-CMS: landing + páginas agrupadas por formato) ──
CREATE TABLE IF NOT EXISTS public.paginas_web (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    es_landing     boolean NOT NULL DEFAULT false,
    formato_id     uuid REFERENCES public.paginas_web_formatos(id) ON DELETE SET NULL,
    modo           text NOT NULL DEFAULT 'secciones' CHECK (modo IN ('secciones', 'simple')),
    titulo         text NOT NULL DEFAULT 'Nueva página',
    slug           text NOT NULL,
    publicada      boolean NOT NULL DEFAULT false,
    design_tokens  jsonb NOT NULL DEFAULT '{}'::jsonb,
    editor_content jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.paginas_web ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'secciones';

-- Migration: instalaciones con el esquema anterior (tipo 'landing'/'oferta'/'pagina')
ALTER TABLE public.paginas_web ADD COLUMN IF NOT EXISTS es_landing boolean NOT NULL DEFAULT false;
ALTER TABLE public.paginas_web ADD COLUMN IF NOT EXISTS formato_id uuid REFERENCES public.paginas_web_formatos(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'paginas_web' AND column_name = 'tipo') THEN
    UPDATE public.paginas_web SET es_landing = true WHERE tipo = 'landing';

    INSERT INTO public.paginas_web_formatos (nombre, slug)
    SELECT 'Ofertas', 'ofertas'
    WHERE EXISTS (SELECT 1 FROM public.paginas_web WHERE tipo = 'oferta')
      AND NOT EXISTS (SELECT 1 FROM public.paginas_web_formatos WHERE slug = 'ofertas');

    UPDATE public.paginas_web
    SET formato_id = (SELECT id FROM public.paginas_web_formatos WHERE slug = 'ofertas')
    WHERE tipo = 'oferta';

    ALTER TABLE public.paginas_web DROP COLUMN tipo;
  END IF;
END $$;

ALTER TABLE public.paginas_web ADD COLUMN IF NOT EXISTS titulo text NOT NULL DEFAULT 'Nueva página';
ALTER TABLE public.paginas_web ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.paginas_web ADD COLUMN IF NOT EXISTS publicada boolean NOT NULL DEFAULT false;
ALTER TABLE public.paginas_web ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
UPDATE public.paginas_web SET es_landing = true, slug = 'home', titulo = 'Página principal', publicada = true
WHERE slug IS NULL AND NOT EXISTS (SELECT 1 FROM public.paginas_web WHERE es_landing = true);
ALTER TABLE public.paginas_web ALTER COLUMN slug SET NOT NULL;

-- Solo una landing por agencia
CREATE UNIQUE INDEX IF NOT EXISTS idx_paginas_web_landing_unica
    ON public.paginas_web(es_landing) WHERE (es_landing = true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_paginas_web_slug ON public.paginas_web(slug);
CREATE INDEX IF NOT EXISTS idx_paginas_web_formato_id ON public.paginas_web(formato_id);

GRANT ALL ON public.paginas_web TO anon, authenticated, service_role;
ALTER TABLE public.paginas_web ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.paginas_web;
CREATE POLICY "service_role_all" ON public.paginas_web FOR ALL TO service_role USING (true);

-- Asegura que exista la landing por defecto
INSERT INTO public.paginas_web (es_landing, titulo, slug, publicada)
SELECT true, 'Página principal', 'home', true
WHERE NOT EXISTS (SELECT 1 FROM public.paginas_web WHERE es_landing = true);

-- ── Movimientos OFIviaje (pagos y cobros crudos de los XML de Drive) ────────
-- Persisten los registros de los XML "TSRLstVPagos_*" (pagos) y
-- "TSRLiquidacionCajas_*" (cobros por transferencia) tal como los parsea
-- src/lib/banco/ofiviajeParser.ts, para poder listarlos/filtrarlos sin tener
-- que releer y reparsear los ficheros de Drive en cada consulta.
CREATE TABLE IF NOT EXISTS ofi_pagos (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id                UUID NOT NULL REFERENCES config_oficinas(id),
  drive_file_id             TEXT NOT NULL,
  drive_file_nombre         TEXT NOT NULL,

  documento                 VARCHAR(50) NOT NULL,
  fecha_vencto              DATE,
  fecha_doc                 DATE,
  referencia_prov_cte       VARCHAR(50),
  documento_cobro_pago      VARCHAR(50),
  tipo_operacion            VARCHAR(10),
  cuenta_tesoreria          VARCHAR(50),
  nombre_pasajero           VARCHAR(255),
  apunte                    VARCHAR(50),
  importe_pendiente         DECIMAL(12,2) NOT NULL,
  situacion                 VARCHAR(20),
  proveedor_nombre          VARCHAR(255),
  proveedor_cuenta_contable VARCHAR(50),

  -- Movimiento bancario al que quedó conciliado este pago (lo rellena el
  -- matching de OFIviaje en ofiviajeMatch.ts al conciliar, si la fila ya
  -- estaba descargada en esta tabla).
  movimiento_banco_id       UUID REFERENCES contabilidad_movimientos_banco(id) ON DELETE SET NULL,

  -- Importe de este pago que se concilió contra movimiento_banco_id.
  -- Permite conciliación parcial: si < importe_pendiente, el pago está parcialmente conciliado.
  importe_conciliado        DECIMAL(12,2) DEFAULT 0,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (oficina_id, documento, apunte)
);

CREATE INDEX IF NOT EXISTS idx_ofi_pagos_oficina    ON ofi_pagos(oficina_id);
CREATE INDEX IF NOT EXISTS idx_ofi_pagos_documento  ON ofi_pagos(documento);
CREATE INDEX IF NOT EXISTS idx_ofi_pagos_drive_file ON ofi_pagos(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_ofi_pagos_fecha      ON ofi_pagos(fecha_vencto);
CREATE INDEX IF NOT EXISTS idx_ofi_pagos_movimiento ON ofi_pagos(movimiento_banco_id);

GRANT ALL ON public.ofi_pagos TO anon, authenticated, service_role;
ALTER TABLE public.ofi_pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.ofi_pagos;
CREATE POLICY "service_role_all" ON public.ofi_pagos FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS ofi_cobros (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id            UUID NOT NULL REFERENCES config_oficinas(id),
  drive_file_id         TEXT NOT NULL,
  drive_file_nombre     TEXT NOT NULL,

  factura               VARCHAR(50),
  fecha_movimiento      DATE,
  nombre_pagador        VARCHAR(255),
  concepto_movimiento   TEXT,
  importe_cobro         DECIMAL(12,2) NOT NULL,

  -- Movimiento bancario al que quedó conciliado este cobro (ver comentario
  -- análogo en ofi_pagos.movimiento_banco_id).
  movimiento_banco_id   UUID REFERENCES contabilidad_movimientos_banco(id) ON DELETE SET NULL,

  -- Importe de este cobro que se concilió contra movimiento_banco_id.
  -- Permite conciliación parcial: si < importe_cobro, el cobro está parcialmente conciliado.
  importe_conciliado    DECIMAL(12,2) DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (oficina_id, factura, fecha_movimiento, nombre_pagador, importe_cobro)
);

CREATE INDEX IF NOT EXISTS idx_ofi_cobros_oficina    ON ofi_cobros(oficina_id);
CREATE INDEX IF NOT EXISTS idx_ofi_cobros_drive_file ON ofi_cobros(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_ofi_cobros_fecha      ON ofi_cobros(fecha_movimiento);
CREATE INDEX IF NOT EXISTS idx_ofi_cobros_movimiento ON ofi_cobros(movimiento_banco_id);

GRANT ALL ON public.ofi_cobros TO anon, authenticated, service_role;
ALTER TABLE public.ofi_cobros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.ofi_cobros;
CREATE POLICY "service_role_all" ON public.ofi_cobros FOR ALL TO service_role USING (true);

-- ============================================================
-- RPC FUNCTIONS - GASTOS FINANCIEROS
-- ============================================================

-- RPC para obtener suma total de gastos financieros
CREATE OR REPLACE FUNCTION get_gastos_financieros_total()
RETURNS TABLE (
  total_gastos_financieros DECIMAL,
  cantidad_movimientos BIGINT,
  promedio_gasto DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUM(ABS(importe))::DECIMAL as total_gastos_financieros,
    COUNT(*)::BIGINT as cantidad_movimientos,
    AVG(ABS(importe))::DECIMAL as promedio_gasto
  FROM contabilidad_movimientos_banco
  WHERE es_gasto_financiero = true
    AND deleted = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para obtener gastos financieros por mes
CREATE OR REPLACE FUNCTION get_gastos_financieros_por_mes(p_año INT DEFAULT NULL)
RETURNS TABLE (
  mes VARCHAR,
  total DECIMAL,
  cantidad INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(fecha_operacion, 'YYYY-MM') as mes,
    SUM(ABS(importe))::DECIMAL as total,
    COUNT(*)::INT as cantidad
  FROM contabilidad_movimientos_banco
  WHERE es_gasto_financiero = true
    AND deleted = false
    AND (p_año IS NULL OR EXTRACT(YEAR FROM fecha_operacion)::INT = p_año)
  GROUP BY TO_CHAR(fecha_operacion, 'YYYY-MM')
  ORDER BY mes DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para obtener gastos financieros por oficina
CREATE OR REPLACE FUNCTION get_gastos_financieros_por_oficina(p_año INT DEFAULT NULL)
RETURNS TABLE (
  oficina_id UUID,
  total DECIMAL,
  cantidad INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cb.oficina_id,
    SUM(ABS(cmb.importe))::DECIMAL as total,
    COUNT(*)::INT as cantidad
  FROM contabilidad_movimientos_banco cmb
  JOIN config_cuentas_bancarias cb ON cmb.cuenta_bancaria_id = cb.id
  WHERE cmb.es_gasto_financiero = true
    AND cmb.deleted = false
    AND (p_año IS NULL OR EXTRACT(YEAR FROM cmb.fecha_operacion)::INT = p_año)
  GROUP BY cb.oficina_id
  ORDER BY total DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

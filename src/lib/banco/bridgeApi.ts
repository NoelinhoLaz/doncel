import { createAdminServiceClient } from "@/lib/supabaseServer";
import { getAgencyDbClient, getAgencyDbClientById } from "@/lib/agencyDb";
import { encrypt } from "@/lib/encryption";

const BRIDGE_API_URL = "https://api.bridgeapi.io/v3";
const BRIDGE_VERSION = "2025-01-15";
const BRIDGE_CLIENT_ID = process.env.BRIDGE_CLIENT_ID?.trim() || "";
const BRIDGE_CLIENT_SECRET = process.env.BRIDGE_CLIENT_SECRET?.trim() || "";

function bridgeHeaders(extra?: Record<string, string>) {
  return {
    "Content-Type": "application/json",
    "Bridge-Version": BRIDGE_VERSION,
    "Client-Id": BRIDGE_CLIENT_ID,
    "Client-Secret": BRIDGE_CLIENT_SECRET,
    ...extra,
  };
}

class BridgeApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function bridgeFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BRIDGE_API_URL}${path}`, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const firstError = data?.errors?.[0];
    const code = firstError?.code;
    const message = data?.message || firstError?.message || code || `Bridge API error (${res.status}) en ${path}`;
    throw new BridgeApiError(res.status, message, code);
  }
  return data;
}

/**
 * Crea (o recupera si ya existe, Bridge devuelve 409) el usuario Bridge asociado
 * a esta agencia, y persiste el mapeo en la BD admin (por agencia_slug, external_user_id
 * en Bridge) para poder resolver el tenant destino cuando llega un webhook.
 */
async function createOrGetBridgeUser(agenciaSlug: string): Promise<string> {
  const adminDb = createAdminServiceClient();

  const { data: existing } = await adminDb
    .from("admin_bridge_users")
    .select("bridge_user_uuid")
    .eq("agencia_slug", agenciaSlug)
    .maybeSingle();

  if (existing?.bridge_user_uuid) return existing.bridge_user_uuid;

  let userUuid: string;
  try {
    const created = await bridgeFetch("/aggregation/users", {
      method: "POST",
      headers: bridgeHeaders(),
      body: JSON.stringify({ external_user_id: agenciaSlug }),
    });
    userUuid = created.uuid;
  } catch (err) {
    // Recuperamos por GET cuando el POST falla porque el usuario ya existía (409),
    // o porque el sandbox llegó a su límite de usuarios (403 app.users.maximum_reached)
    // y es probable que este external_user_id ya esté entre los creados.
    // Cualquier otro error (401 credenciales inválidas, 5xx, etc.) debe propagarse tal cual.
    const recuperable =
      err instanceof BridgeApiError &&
      (err.status === 409 || (err.status === 403 && err.code === "app.users.maximum_reached"));
    if (!recuperable) throw err;

    // El listado de /aggregation/users no filtra de forma fiable por external_user_id:
    // buscamos la coincidencia exacta dentro de la lista devuelta.
    const list = await bridgeFetch(
      `/aggregation/users?external_user_id=${encodeURIComponent(agenciaSlug)}`,
      { headers: bridgeHeaders() }
    );
    const match = (list?.resources || []).find((u: any) => u.external_user_id === agenciaSlug);
    userUuid = match?.uuid;
    if (!userUuid) {
      throw new Error(
        `No existe un usuario de Bridge para "${agenciaSlug}" y no se puede crear uno nuevo (límite de usuarios sandbox alcanzado). Borra usuarios de prueba en el dashboard de Bridge o mapea manualmente esta agencia a un bridge_user_uuid existente en admin_bridge_users.`
      );
    }
  }

  await adminDb
    .from("admin_bridge_users")
    .upsert({ bridge_user_uuid: userUuid, agencia_slug: agenciaSlug }, { onConflict: "agencia_slug" });

  return userUuid;
}

async function getBridgeAccessToken(userUuid: string): Promise<string> {
  const data = await bridgeFetch("/aggregation/authorization/token", {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({ user_uuid: userUuid }),
  });

  const { encryptedData, iv, authTag } = encrypt(data.access_token);

  const adminDb = createAdminServiceClient();
  await adminDb
    .from("admin_bridge_users")
    .update({
      access_token_enc: encryptedData,
      access_token_iv: iv,
      access_token_tag: authTag,
      token_expires_at: data.expires_at || null,
    })
    .eq("bridge_user_uuid", userUuid);

  return data.access_token;
}

/**
 * Crea una sesión de Bridge Connect y devuelve la URL a abrir (popup) para
 * que el usuario autentique y conecte su banco.
 */
export async function createBridgeConnectSession(
  agenciaSlug: string,
  userEmail: string
): Promise<{ connectUrl?: string; error?: string }> {
  if (!BRIDGE_CLIENT_ID || !BRIDGE_CLIENT_SECRET) {
    return { error: "Bridge no está configurado (faltan BRIDGE_CLIENT_ID / BRIDGE_CLIENT_SECRET)." };
  }

  try {
    const userUuid = await createOrGetBridgeUser(agenciaSlug);
    const accessToken = await getBridgeAccessToken(userUuid);

    const session = await bridgeFetch("/aggregation/user-management-sessions", {
      method: "POST",
      headers: bridgeHeaders({ Authorization: `Bearer ${accessToken}` }),
      body: JSON.stringify({ user_email: userEmail }),
    });

    return { connectUrl: session.url };
  } catch (error: any) {
    console.error("[Bridge] Error creando sesión de conexión:", error);
    return { error: error.message || "Error al iniciar la conexión con Bridge." };
  }
}

/**
 * Normaliza una transacción de Bridge al shape de contabilidad_movimientos_banco
 * y hace upsert por bridge_id (índice único parcial), garantizando que un mismo
 * movimiento Bridge nunca se duplique, sin colisionar con movimientos importados por N43.
 */
async function upsertBridgeTransactions(
  agencyDb: any,
  cuentaBancariaIdPorBridgeAccountId: Record<string, string>,
  transacciones: any[]
) {
  if (transacciones.length === 0) return { insertados: 0 };

  const movimientos = transacciones
    .map((tx) => {
      const cuentaBancariaId = cuentaBancariaIdPorBridgeAccountId[String(tx.account_id)];
      if (!cuentaBancariaId) return null;

      return {
        cuenta_bancaria_id: cuentaBancariaId,
        fecha_operacion: (tx.date || tx.transaction_date || "").slice(0, 10),
        fecha_valor: (tx.date || tx.transaction_date || "").slice(0, 10),
        fecha_transaccion: (tx.transaction_date || tx.date || "").slice(0, 10),
        fecha_contable: (tx.booking_date || tx.date || "").slice(0, 10),
        importe: tx.amount,
        // provider_description es el texto completo tal como lo da el banco;
        // clean_description es una versión "limpiada" por Bridge que a veces
        // recorta números/códigos de referencia (ej. "World 2 Meet" -> "World Meet").
        // Usamos el texto completo como concepto_original y guardamos el limpio aparte.
        concepto_original: tx.provider_description || tx.clean_description || tx.description || "",
        concepto_limpio: tx.clean_description || tx.provider_description || "",
        moneda: tx.currency_code || "EUR",
        origen: "bridge",
        bridge_id: tx.id,
        bridge_account_id: tx.account_id,
        operation_type: tx.operation_type || null,
        category_id: tx.category_id ?? null,
        future: tx.future ?? false,
        bridge_raw: tx,
        estado: "pendiente",
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  if (movimientos.length === 0) return { insertados: 0 };

  // Deduplicación cruzada con otros orígenes (ej. N43 importado manualmente):
  // un mismo movimiento real puede existir ya sin bridge_id, así que además del
  // upsert por bridge_id se descartan candidatos que coincidan en cuenta+importe+fecha
  // con un movimiento ya existente de cualquier origen.
  const cuentaIds = [...new Set(movimientos.map((m) => m.cuenta_bancaria_id))];
  const fechas = movimientos.map((m) => m.fecha_operacion).filter(Boolean);
  const fechaMin = fechas.length ? fechas.reduce((a, b) => (a < b ? a : b)) : null;
  const fechaMax = fechas.length ? fechas.reduce((a, b) => (a > b ? a : b)) : null;

  let existentesSet = new Set<string>();
  if (fechaMin && fechaMax) {
    const { data: existentes } = await agencyDb
      .from("contabilidad_movimientos_banco")
      .select("cuenta_bancaria_id, importe, fecha_operacion")
      .in("cuenta_bancaria_id", cuentaIds)
      .eq("deleted", false)
      .is("bridge_id", null)
      .gte("fecha_operacion", fechaMin)
      .lte("fecha_operacion", fechaMax);

    existentesSet = new Set(
      (existentes || []).map((e: any) => `${e.cuenta_bancaria_id}|${e.importe}|${e.fecha_operacion}`)
    );
  }

  const movimientosSinDuplicar = movimientos.filter(
    (m) => !existentesSet.has(`${m.cuenta_bancaria_id}|${m.importe}|${m.fecha_operacion}`)
  );

  if (movimientosSinDuplicar.length === 0) return { insertados: 0 };

  const { error, data } = await agencyDb
    .from("contabilidad_movimientos_banco")
    .upsert(movimientosSinDuplicar, {
      onConflict: "bridge_id",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) {
    console.error("[Bridge] Error insertando movimientos:", error);
    throw new Error(error.message);
  }

  return { insertados: data?.length || 0 };
}

/**
 * Sincroniza movimientos desde Bridge para todas las cuentas conectadas de la agencia dada.
 * Mapea cuentas Bridge -> cuentas locales por bridge_account_id (guardado tras la primera conexión),
 * o por IBAN si aún no existe el mapeo.
 *
 * agencyDb ya resuelto por el llamador: getAgencyDbClient() (sesión de usuario, flujo manual)
 * o getAgencyDbClientById() (server-to-server, webhook).
 */
async function syncBridgeTransactionsForAgency(
  agenciaSlug: string,
  agencyDb: any
): Promise<{ insertados: number; error?: string }> {
  if (!BRIDGE_CLIENT_ID || !BRIDGE_CLIENT_SECRET) {
    return { insertados: 0, error: "Bridge no está configurado." };
  }

  try {
    const userUuid = await createOrGetBridgeUser(agenciaSlug);
    const accessToken = await getBridgeAccessToken(userUuid);

    const [accountsRes, transactionsRes] = await Promise.all([
      bridgeFetch("/aggregation/accounts", { headers: bridgeHeaders({ Authorization: `Bearer ${accessToken}` }) }),
      bridgeFetch("/aggregation/transactions?limit=500", { headers: bridgeHeaders({ Authorization: `Bearer ${accessToken}` }) }),
    ]);

    const bridgeAccounts: any[] = accountsRes?.resources || [];
    const transacciones: any[] = transactionsRes?.resources || [];

    // Mapear cuentas Bridge -> cuentas locales: por bridge_account_id ya guardado, o por IBAN.
    const { data: cuentasLocales } = await agencyDb
      .from("config_cuentas_bancarias")
      .select("id, iban, bridge_account_id, bridge_item_id");

    const mapaPorBridgeAccountId: Record<string, string> = {};
    for (const cuenta of cuentasLocales || []) {
      if (cuenta.bridge_account_id) mapaPorBridgeAccountId[cuenta.bridge_account_id] = cuenta.id;
    }

    // Para cuentas Bridge sin mapeo aún, intentar por IBAN y persistir el mapeo.
    for (const bAccount of bridgeAccounts) {
      const bAccountId = String(bAccount.id);
      if (mapaPorBridgeAccountId[bAccountId]) continue;

      const cuentaPorIban = (cuentasLocales || []).find(
        (c: any) => c.iban && bAccount.iban && c.iban.replace(/\s/g, "") === bAccount.iban.replace(/\s/g, "")
      );
      if (cuentaPorIban) {
        mapaPorBridgeAccountId[bAccountId] = cuentaPorIban.id;
        await agencyDb
          .from("config_cuentas_bancarias")
          .update({ bridge_account_id: bAccountId, bridge_item_id: String(bAccount.item_id || "") })
          .eq("id", cuentaPorIban.id);
      }
    }

    const { insertados } = await upsertBridgeTransactions(agencyDb, mapaPorBridgeAccountId, transacciones);
    return { insertados };
  } catch (error: any) {
    console.error("[Bridge] Error sincronizando transacciones:", error);
    return { insertados: 0, error: error.message || "Error al sincronizar con Bridge." };
  }
}

/**
 * Sincroniza movimientos Bridge para la agencia del usuario actualmente autenticado.
 * Uso: flujo manual desde la UI (botón "Sincronizar").
 */
export async function syncBridgeTransactions(agenciaSlug: string): Promise<{ insertados: number; error?: string }> {
  const agencyDb = await getAgencyDbClient();
  return syncBridgeTransactionsForAgency(agenciaSlug, agencyDb);
}

/**
 * Resuelve la agencia a partir del bridge_user_uuid recibido en un webhook,
 * y sincroniza sus movimientos sin depender de sesión de usuario. Usado por el webhook.
 */
export async function syncBridgeTransactionsByUserUuid(bridgeUserUuid: string): Promise<{ insertados: number; error?: string }> {
  const adminDb = createAdminServiceClient();
  const { data: mapping, error } = await adminDb
    .from("admin_bridge_users")
    .select("agencia_slug")
    .eq("bridge_user_uuid", bridgeUserUuid)
    .maybeSingle();

  if (error || !mapping) {
    return { insertados: 0, error: "No se encontró la agencia asociada a este usuario de Bridge." };
  }

  const { data: agencia } = await adminDb
    .from("agencias")
    .select("id")
    .eq("slug", mapping.agencia_slug)
    .maybeSingle();

  if (!agencia) {
    return { insertados: 0, error: `No existe ninguna agencia con slug "${mapping.agencia_slug}".` };
  }

  const agencyDb = await getAgencyDbClientById(agencia.id);
  return syncBridgeTransactionsForAgency(mapping.agencia_slug, agencyDb);
}

/**
 * Sincroniza movimientos Bridge para TODAS las agencias que ya tienen un
 * usuario Bridge registrado (admin_bridge_users). Uso: cron diario.
 */
export async function syncBridgeTransactionsAllAgencies(): Promise<
  { agenciaSlug: string; insertados: number; error?: string }[]
> {
  const adminDb = createAdminServiceClient();
  const { data: mappings, error } = await adminDb.from("admin_bridge_users").select("agencia_slug");

  if (error || !mappings) return [];

  const resultados: { agenciaSlug: string; insertados: number; error?: string }[] = [];

  for (const mapping of mappings) {
    try {
      const { data: agencia } = await adminDb
        .from("agencias")
        .select("id")
        .eq("slug", mapping.agencia_slug)
        .maybeSingle();

      if (!agencia) {
        resultados.push({ agenciaSlug: mapping.agencia_slug, insertados: 0, error: "Agencia no encontrada." });
        continue;
      }

      const agencyDb = await getAgencyDbClientById(agencia.id);
      const result = await syncBridgeTransactionsForAgency(mapping.agencia_slug, agencyDb);
      resultados.push({ agenciaSlug: mapping.agencia_slug, ...result });
    } catch (err: any) {
      resultados.push({ agenciaSlug: mapping.agencia_slug, insertados: 0, error: err.message });
    }
  }

  return resultados;
}

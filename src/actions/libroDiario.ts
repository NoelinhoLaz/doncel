"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";

export async function getLibroDiario(options?: {
  page?: number;
  limit?: number;
  search?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  cuentaId?: string;
  ejercicio?: number;
  vista?: "asiento" | "apunte";
}) {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 15;
  const search = options?.search ?? "";
  const fechaDesde = options?.fechaDesde;
  const fechaHasta = options?.fechaHasta;
  const cuentaId = options?.cuentaId;
  const ejercicio = options?.ejercicio;
  const vista = options?.vista ?? "asiento";

  try {
    const agencyDb = await getAgencyDbClient();

    if (vista === "apunte") {
      let query = agencyDb
        .from("contabilidad_apuntes")
        .select(`
          *,
          config_cuentas_contables (
            codigo,
            descripcion
          ),
          contabilidad_entidades (
            nombre
          ),
          contabilidad_proveedores (
            nombre
          ),
          contabilidad_asientos (
            numero,
            fecha,
            estado,
            concepto
          )
        `, { count: "exact" });

      if (cuentaId) {
        query = query.eq("cuenta_id", cuentaId);
      }

      if (fechaDesde) {
        query = query.gte("fecha", fechaDesde);
      }
      if (fechaHasta) {
        query = query.lte("fecha", fechaHasta);
      }

      if (ejercicio) {
        query = query
          .gte("fecha", `${ejercicio}-01-01`)
          .lte("fecha", `${ejercicio}-12-31`);
      }

      if (search && search.trim().length >= 3) {
        const term = `%${search.trim()}%`;
        query = query.or(`concepto.ilike.${term},subcuenta.ilike.${term}`);
      }

      const from = (page - 1) * limit;
      const to = page * limit - 1;

      const { data, error, count } = await query
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("Error fetching general ledger entries:", error);
        throw error;
      }

      const mappedApuntes = (data || []).map((ap: any) => ({
        ...ap,
        asientoNumero: ap.contabilidad_asientos?.numero ?? null,
        asientoFecha: ap.contabilidad_asientos?.fecha ?? ap.fecha,
        asientoEstado: ap.contabilidad_asientos?.estado ?? null,
        asientoConcepto: ap.contabilidad_asientos?.concepto ?? null
      }));

      return {
        data: [],
        count: count || 0,
        pendientes: mappedApuntes
      };
    }

    // 1. Si se filtró por una cuenta específica, obtenemos los IDs de los asientos que la contienen
    let asientoIdsDeCuenta: string[] = [];
    if (cuentaId) {
      const { data: apuntesDeCuenta, error: errAp } = await agencyDb
        .from("contabilidad_apuntes")
        .select("asiento_id")
        .eq("cuenta_id", cuentaId);

      if (errAp) {
        console.error("Error fetching seat IDs for account filter:", errAp);
        throw errAp;
      }

      asientoIdsDeCuenta = apuntesDeCuenta?.map((a: any) => a.asiento_id).filter(Boolean) || [];
      
      // Si no hay apuntes con esa cuenta, devolvemos resultado vacío inmediatamente
      if (asientoIdsDeCuenta.length === 0) {
        return { data: [], count: 0, pendientes: [] };
      }
    }

    // 2. Si hay término de búsqueda, buscamos asientos por número/concepto o apuntes que coincidan con la cuenta/concepto
    let asientoIdsDeBusqueda: string[] = [];
    let hasSearchFilter = false;

    if (search && search.trim().length >= 3) {
      hasSearchFilter = true;
      const term = `%${search.trim()}%`;

      // A. Buscar cuentas que coincidan por código o descripción
      const { data: matchingCuentas } = await agencyDb
        .from("config_cuentas_contables")
        .select("id")
        .or(`codigo.ilike.${term},descripcion.ilike.${term}`);

      const matchingCuentaIds = matchingCuentas?.map((c: any) => c.id) || [];

      // B. Buscar apuntes que coincidan en concepto o toquen estas cuentas
      let apQuery = agencyDb.from("contabilidad_apuntes").select("asiento_id");
      if (matchingCuentaIds.length > 0) {
        apQuery = apQuery.or(`concepto.ilike.${term},cuenta_id.in.(${matchingCuentaIds.join(",")})`);
      } else {
        apQuery = apQuery.ilike("concepto", term);
      }

      const { data: matchingApuntes, error: errApSearch } = await apQuery;
      if (errApSearch) {
        console.error("Error searching in accounting entries:", errApSearch);
      }

      asientoIdsDeBusqueda = matchingApuntes?.map((a: any) => a.asiento_id).filter(Boolean) || [];
    }

    // 3. Construir la consulta principal sobre contabilidad_asientos
      let query = agencyDb
        .from("contabilidad_asientos")
        .select(`
          *,
          contabilidad_apuntes (
            id,
            created_at,
            fecha,
            debe,
            haber,
            concepto,
            cuenta_id,
            entidad_id,
            proveedor_id,
            subcuenta,
            config_cuentas_contables (
              codigo,
              descripcion
            ),
            contabilidad_entidades (
              nombre
            ),
            contabilidad_proveedores (
              nombre
            )
          )
        `, { count: "exact" });

    // Aplicar filtros de ID de asiento de cuenta y búsqueda
    if (cuentaId) {
      if (hasSearchFilter) {
        const intersectIds = asientoIdsDeCuenta.filter(id => asientoIdsDeBusqueda.includes(id));
        if (intersectIds.length === 0) {
          return { data: [], count: 0, pendientes: [] };
        }
        query = query.in("id", intersectIds);
      } else {
        query = query.in("id", asientoIdsDeCuenta);
      }
    } else if (hasSearchFilter) {
      const term = `%${search.trim()}%`;
      let orConditions = `numero.ilike.${term},concepto.ilike.${term}`;
      if (asientoIdsDeBusqueda.length > 0) {
        const slicedIds = asientoIdsDeBusqueda.slice(0, 100);
        orConditions += `,id.in.(${slicedIds.join(",")})`;
      }
      query = query.or(orConditions);
    }

    // Filtros de fecha
    if (fechaDesde) {
      query = query.gte("fecha", fechaDesde);
    }
    if (fechaHasta) {
      query = query.lte("fecha", fechaHasta);
    }

    // Filtro de ejercicio fiscal
    if (ejercicio) {
      query = query.eq("ejercicio", ejercicio);
    }

    // Paginación
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    const { data, error, count } = await query
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching general ledger seats:", error);
      throw error;
    }

    // 4. Obtener apuntes pendientes (sin asiento)
    let pendientes: any[] = [];
    if (!cuentaId) {
      let pendQuery = agencyDb
        .from("contabilidad_apuntes")
        .select(`
          *,
          config_cuentas_contables (
            codigo,
            descripcion
          ),
          contabilidad_entidades (
            nombre
          ),
          contabilidad_proveedores (
            nombre
          )
        `)
        .is("asiento_id", null);

      if (fechaDesde) {
        pendQuery = pendQuery.gte("fecha", fechaDesde);
      }
      if (fechaHasta) {
        pendQuery = pendQuery.lte("fecha", fechaHasta);
      }
      if (hasSearchFilter) {
        const term = `%${search.trim()}%`;
        pendQuery = pendQuery.or(`concepto.ilike.${term},subcuenta.ilike.${term}`);
      }

      const { data: pendData, error: pendError } = await pendQuery
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!pendError) {
        pendientes = pendData || [];
      } else {
        console.error("Error fetching pending apuntes:", pendError);
      }
    }

    return {
      data: data || [],
      count: count || 0,
      pendientes
    };
  } catch (error: any) {
    console.error("Failed to get general ledger:", error.message);
    throw new Error(error.message || "Failed to fetch general ledger");
  }
}

export async function getCuentasContables() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("config_cuentas_contables")
      .select("id, codigo, descripcion, tipo, permite_apuntes")
      .order("codigo", { ascending: true });

    if (error) {
      console.error("Error fetching accounts list:", error);
      throw error;
    }

    return data || [];
  } catch (error: any) {
    console.error("Failed to get chart of accounts:", error.message);
    throw new Error(error.message || "Failed to fetch chart of accounts");
  }
}

export async function getEjerciciosDisponibles() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_asientos")
      .select("ejercicio")
      .order("ejercicio", { ascending: false });

    if (error) {
      console.error("Error fetching fiscal years:", error);
      throw error;
    }

    const years = Array.from(new Set(data?.map((item: any) => item.ejercicio).filter(Boolean) || []));

    if (years.length === 0) {
      return [new Date().getFullYear()];
    }

    return years;
  } catch (error: any) {
    console.error("Failed to get fiscal years:", error.message);
    return [new Date().getFullYear()];
  }
}

export async function getMovimientosCajaDia(fecha?: string) {
  const selectedFecha = fecha || new Date().toISOString().split("T")[0];
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("contabilidad_movimientos")
      .select(`
        *,
        entidad:contabilidad_entidades!contabilidad_movimientos_entidad_id_fkey(nombre),
        expediente:operativa_expedientes(numero, referencia)
      `)
      .eq("fecha", selectedFecha)
      .in("medio_pago", ["efectivo", "tarjeta"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error in getMovimientosCajaDia:", error);
      throw error;
    }

    return (data || []).map((mov: any) => ({
      ...mov,
      entidad_nombre: mov.entidad?.nombre || "—",
      expediente_numero: mov.expediente?.numero || "—",
      expediente_referencia: mov.expediente?.referencia || "—"
    }));
  } catch (error: any) {
    console.error("Failed to get cash/card movements of day:", error.message);
    throw new Error(error.message || "Failed to fetch cash/card movements of day");
  }
}

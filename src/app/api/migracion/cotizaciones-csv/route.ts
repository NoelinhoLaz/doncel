import { NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";
import { getCurrentAgentePublic } from "@/actions/crm";
import { getTiposServicios } from "@/actions/tiposServicios";
import { createAdminServiceClient } from "@/lib/supabaseServer";
import fs from "fs";
import path from "path";

const TIPO_MAP: Record<string, string[]> = {
  alojamiento:   ["alojamiento", "hotel", "hospedaje"],
  transporte:    ["transporte", "vuelo", "avión", "avion"],
  desplazamientos: ["desplazamientos", "desplazamiento", "traslado", "traslados", "autobús", "autobus", "bus", "autocar", "transfer", "taxi", "chófer", "chofer"],
  entradas:      ["entradas", "entrada", "monumento", "museo", "visita"],
  actividades:   ["actividades", "actividad", "excursión"],
  guias:         ["guias", "guía", "guia"],
  restauracion:  ["restauracion", "restauración", "comida", "cena", "almuerzo"],
  seguro:        ["seguro"],
  suplementos:   ["suplementos", "suplemento"],
  extrasViajero: ["extras", "extra"],
  monitores:     ["monitores", "monitor"],
  packs:         ["pack", "packs"],
  otros:         ["otros", "otro", "conceptos", "papeletas", "papeleta", "loteria", "lotería"],
};

function findTipoId(tiposMap: Record<string, any>, categoria: string): string | null {
  const keywords = TIPO_MAP[categoria] ?? [categoria.toLowerCase()];
  for (const tipo of Object.values(tiposMap)) {
    const etq = (tipo.etiqueta ?? "").toLowerCase();
    if (keywords.some((k) => etq.includes(k))) return tipo.id;
  }
  return Object.keys(tiposMap)[0] ?? null;
}

async function convertirServicios(
  servicios: any,
  tiposMap: Record<string, any>,
  resolveProviderId: (providerName: string | null) => Promise<string | null> | string | null
): Promise<any[]> {
  const lineas: any[] = [];

  const push = async (categoria: string, items: any[]) => {
    for (const s of items) {
      let activeCategory = categoria;
      if (categoria === "transporte") {
        const desc = ((s.medioTransporte || "") + " " + (s.descripcion || "") + " " + (s.observaciones || "")).toLowerCase();
        if (desc.includes("autobús") || desc.includes("autobus") || desc.includes("bus") || desc.includes("autocar") || desc.includes("transfer") || desc.includes("traslado") || desc.includes("chofer") || desc.includes("chófer")) {
          activeCategory = "desplazamientos";
        }
      }

      // Check if description or type matches lottery/papeletas/others
      const descText = ((s.descripcion || "") + " " + (s.observaciones || "") + " " + (s.nombre || "") + " " + (s.tipo || "")).toLowerCase();
      if (descText.includes("papeleta") || descText.includes("papeletas") || descText.includes("loteria") || descText.includes("lotería") || descText.includes("otro") || descText.includes("otros")) {
        activeCategory = "otros";
      }

      const tipoId = findTipoId(tiposMap, activeCategory);
      const providerId = s.proveedor && typeof s.proveedor === "string" && s.proveedor.trim()
        ? await resolveProviderId(s.proveedor.trim())
        : null;

      const linea: any = {
        tipo: tipoId,
        descripcion: s.observaciones || s.notas || s.descripcion || s.nombre || "",
        proveedor: providerId,
        destino: null,
        plazas: null,
        noches: null,
        neto: null,
        pvp: null,
        opcional: s.esExtra ?? false,
        checked: true,
      };

      switch (categoria) {
        case "alojamiento":
          linea.descripcion = [s.nombreAlojamiento, s.tipoAlojamiento, s.categoria, s.regimen, s.uso].filter(Boolean).join(" · ");
          linea.neto = s.precio ?? null;
          linea.noches = s.noches ?? null;
          linea.plazas = s.personas ?? null;
          break;
        case "transporte":
          linea.descripcion = [s.medioTransporte, s.compania, s.clase, s.tipoServicio, s.observaciones].filter(Boolean).join(" · ");
          linea.neto = s.precio ?? null;
          linea.plazas = s.plazas ?? null;
          break;
        case "entradas":
        case "actividades":
          linea.descripcion = [s.nombre, s.tipo, s.horario, s.notas].filter(Boolean).join(" · ");
          linea.neto = s.precio != null ? Number(s.precio) : null;
          linea.plazas = s.cantidad != null ? Number(s.cantidad) : null;
          break;
        case "guias":
          linea.descripcion = [s.tipoServicio, s.idioma, s.especialidad, s.observaciones].filter(Boolean).join(" · ");
          linea.neto = s.precioUnitario ?? null;
          linea.plazas = s.numeroGuias ?? null;
          break;
        case "restauracion":
          linea.descripcion = [s.tipo, s.nombre, s.horario].filter(Boolean).join(" · ");
          linea.neto = s.precio ?? null;
          linea.plazas = s.cantidad != null ? Number(s.cantidad) : (s.plazas ?? null);
          linea.noches = s.dias ?? null;
          break;
        case "seguro":
          linea.descripcion = [s.tipoSeguro, s.coberturaPrincipal, s.descripcion].filter(Boolean).join(" · ");
          linea.neto = s.importe ?? null;
          linea.plazas = s.plazas ?? null;
          break;
        case "extrasViajero":
          linea.descripcion = s.descripcion ?? "";
          linea.neto = s.neto ?? null;
          linea.pvp = s.pvp ?? null;
          linea.opcional = true;
          break;
        default:
          linea.neto = s.precio ?? s.precioUnitario ?? s.importe ?? null;
          linea.plazas = s.plazas ?? s.cantidad ?? null;
      }

      // If the service is optional/extra, default checked to false so it does not add to base totals
      linea.checked = !linea.opcional;

      lineas.push(linea);
    }
  };

  for (const [cat, items] of Object.entries(servicios)) {
    if (Array.isArray(items) && items.length > 0) {
      await push(cat, items as any[]);
    }
  }

  return lineas;
}

/**
 * Parse a single CSV line, respecting double-quoted fields and "" escaping.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parse CSV text into an array of row objects keyed by header name.
 * Handles multi-line quoted fields.
 */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  let pending = "";

  for (let i = 1; i < lines.length; i++) {
    pending += (pending ? "\n" : "") + lines[i];

    // Count unescaped quotes to detect unclosed quoted fields
    let quoteCount = 0;
    for (let j = 0; j < pending.length; j++) {
      if (pending[j] === '"') {
        if (pending[j + 1] === '"') { j++; } else { quoteCount++; }
      }
    }
    if (quoteCount % 2 !== 0) continue; // still inside a quoted field

    const values = parseCSVLine(pending);
    pending = "";
    if (values.length === 0 || values.every((v) => v === "")) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = values[idx] ?? ""; });
    rows.push(row);
  }

  return rows;
}

function parseCSVFile(filePath: string): Record<string, string>[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const text = fs.readFileSync(filePath, "utf-8");
    return parseCSV(text);
  } catch (err) {
    console.error("Error reading CSV file " + filePath, err);
    return [];
  }
}

function cleanNumeric(val: any): number {
  if (val === null || val === undefined || val === "" || String(val).trim() === "") return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

function cleanInteger(val: any): number | null {
  if (val === null || val === undefined || val === "" || String(val).trim() === "") return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
}


export async function POST(req: Request) {
  try {
    const agente = await getCurrentAgentePublic();
    const isOwner = ["Owner", "SuperAdmin", "Admin"].includes(agente.rol ?? "");
    if (!isOwner) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

    const formData = await req.formData();
    const csvFile = formData.get("csv") as File | null;
    const modo = (formData.get("modo") as string) ?? "preview";

    if (!csvFile) {
      return NextResponse.json({ success: false, error: "No se recibió ningún fichero CSV" }, { status: 400 });
    }

    const csvText = await csvFile.text();
    const rows = parseCSV(csvText);

    if (!rows.length) {
      return NextResponse.json({ success: true, data: [], mensaje: "El CSV está vacío o no tiene filas válidas" });
    }

    // Load local CSV helper datasets
    const localUsers = parseCSVFile("/Users/noellazueng/Downloads/usuarios_rows.csv");
    const localProviders = parseCSVFile("/Users/noellazueng/Downloads/proveedores_rows (2).csv");

    // Build agent mappings from usuarios_rows.csv
    const legacyUserMap = new Map<string, string>(); // auth_user_id or id -> email
    localUsers.forEach(u => {
      const email = u.email ? u.email.toLowerCase().trim() : "";
      if (email) {
        if (u.auth_user_id) legacyUserMap.set(u.auth_user_id, email);
        if (u.id) legacyUserMap.set(u.id, email);
      }
    });

    const adminSb = createAdminServiceClient();
    const { data: dbUsers } = await adminSb
      .from("usuarios")
      .select("id, auth_user_id, email, nombre, apellidos");

    const dbUserMapByEmail = new Map<string, { id: string; auth_user_id: string; nombre: string }>();
    (dbUsers ?? []).forEach(u => {
      if (u.email) {
        const nombreCompleto = [u.nombre, u.apellidos].filter(Boolean).join(" ").trim();
        dbUserMapByEmail.set(u.email.toLowerCase().trim(), {
          id: u.id,
          auth_user_id: u.auth_user_id || u.id,
          nombre: nombreCompleto || u.email
        });
      }
    });

    function resolveAgente(usuarioId: string | null) {
      if (!usuarioId) return { id: null, nombre: null };
      const email = legacyUserMap.get(usuarioId);
      if (email) {
        const matched = dbUserMapByEmail.get(email);
        if (matched) {
          return { id: matched.auth_user_id || matched.id, nombre: matched.nombre };
        }
      }
      return { id: usuarioId, nombre: null };
    }

    // Build local CSV provider maps
    const csvProvidersByName = new Map<string, any>();
    localProviders.forEach(p => {
      const nombre = (p.nombre ?? "").toLowerCase().trim();
      const razon = (p.razon_social ?? "").toLowerCase().trim();
      if (nombre) csvProvidersByName.set(nombre, p);
      if (razon) csvProvidersByName.set(razon, p);
    });

    function findProviderInCsv(nameStr: string | null): any | null {
      if (!nameStr) return null;
      const clean = nameStr.toLowerCase().trim();
      if (csvProvidersByName.has(clean)) return csvProvidersByName.get(clean);
      for (const [key, p] of csvProvidersByName.entries()) {
        if (clean.includes(key) || key.includes(clean)) {
          return p;
        }
      }
      return null;
    }

    const agencyDb = await getAgencyDbClient();
    const tiposList = await getTiposServicios();
    const tiposMap = Object.fromEntries(tiposList.map((t: any) => [t.id, t]));

    // Only import the "current version" rows
    const legacyCots = rows
      .filter((r) => r["es_version_actual"] !== "false")
      .map((r) => {
        let servicios: any = {};
        try { servicios = JSON.parse(r["servicios"] ?? "{}"); } catch { /* keep empty */ }
        let ubicaciones: any[] = [];
        try { ubicaciones = JSON.parse(r["ubicaciones"] ?? "[]"); } catch { /* keep empty */ }
        return {
          id: r["id"],
          titulo: r["titulo"],
          descripcion: r["descripcion"],
          plazas: r["plazas"] ? Number(r["plazas"]) : 1,
          free: r["free"] ? Number(r["free"]) : 0,
          pvp_viajero: r["pvp_viajero"] ? Number(r["pvp_viajero"]) : 0,
          estado: r["estado"] ?? "borrador",
          usuario_id: r["usuario_id"] ?? null,
          dia_salida: r["dia_salida"] || null,
          dia_regreso: r["dia_regreso"] || null,
          numero: r["numero"] ?? null,
          servicios,
          ubicaciones,
        };
      });

    if (modo === "preview") {
      // Bulk entity lookup: get all entity names for fuzzy match display
      let entityNames: { id: string; nombre: string }[] = [];
      try {
        const { data: ents } = await agencyDb
          .from("contabilidad_entidades")
          .select("id, nombre")
          .limit(2000);
        entityNames = ents ?? [];
      } catch { /* non-blocking */ }

      const preview = await Promise.all(
        legacyCots.map(async (c) => {
          const resolveProviderIdPreview = (name: string | null) => {
            const matched = findProviderInCsv(name);
            return matched ? matched.id : null;
          };

          const lineas = await convertirServicios(c.servicios, tiposMap, resolveProviderIdPreview);
          const total = Object.entries(c.servicios as any)
            .filter(([key]) => key !== "extrasViajero")
            .map(([, val]) => val)
            .flat()
            .filter((sv: any) => !(sv?.esExtra))
            .reduce((s: number, sv: any) => s + (Number((sv as any)?.total) || 0), 0);

          // Try to find matching entity (case-insensitive substring match)
          const tituloLower = (c.titulo ?? "").toLowerCase();
          const matchedEntity = entityNames.find((e) =>
            tituloLower.includes(e.nombre.toLowerCase()) ||
            e.nombre.toLowerCase().includes(tituloLower.substring(0, 20))
          );

          const resolvedAgente = resolveAgente(c.usuario_id);

          return {
            id: c.id,
            numero: c.numero,
            titulo: c.titulo,
            estado: c.estado,
            lineas_count: lineas.length,
            total,
            agente_id: resolvedAgente.id,
            agente_nombre: resolvedAgente.nombre,
            entidad_id: matchedEntity?.id ?? null,
            entidad_nombre: matchedEntity?.nombre ?? null,
          };
        })
      );
      return NextResponse.json({ success: true, data: preview, total: legacyCots.length });
    }

    // modo === "import"
    const selectedIdsRaw = formData.get("selectedIds") as string | null;
    const selectedIds: string[] | null = selectedIdsRaw ? JSON.parse(selectedIdsRaw) : null;
    const toImport = selectedIds?.length
      ? legacyCots.filter((c) => selectedIds.includes(c.id))
      : legacyCots;

    // Build entity lookup map (nombre -> id) for contacto matching
    let entityMap: { id: string; nombre: string }[] = [];
    try {
      const { data: ents } = await agencyDb
        .from("contabilidad_entidades")
        .select("id, nombre")
        .limit(2000);
      entityMap = ents ?? [];
    } catch { /* non-blocking */ }

    function findEntityId(titulo: string): string | null {
      const tl = titulo.toLowerCase();
      const match = entityMap.find(
        (e) => tl.includes(e.nombre.toLowerCase()) || e.nombre.toLowerCase().includes(tl.substring(0, 20))
      );
      return match?.id ?? null;
    }

    // Fetch existing provider IDs in database
    const dbProviderIds = new Set<string>();
    try {
      const { data: dbProvs } = await agencyDb
        .from("contabilidad_proveedores")
        .select("id");
      (dbProvs ?? []).forEach((p: any) => dbProviderIds.add(p.id));
    } catch { /* non-blocking */ }

    // Helper to resolve and ensure provider exists in DB
    async function resolveAndEnsureProvider(providerName: string | null): Promise<string | null> {
      if (!providerName) return null;
      const matched = findProviderInCsv(providerName);
      if (!matched) return null;

      if (dbProviderIds.has(matched.id)) {
        return matched.id;
      }

      try {
        const insertPayload = {
          id: matched.id,
          nombre: matched.nombre || null,
          tipo: matched.tipo || null,
          observaciones: matched.observaciones || null,
          creado_en: matched.creado_en || null,
          catalogo: matched.catalogo || null,
          razon_social: matched.razon_social || null,
          direccion: matched.direccion || null,
          CIF: matched.CIF || null,
          codigo_postal: matched.codigo_postal || null,
          localidad: matched.localidad || null,
          telefono: matched.telefono || null,
          fax: matched.fax || null,
          comunidad: matched.comunidad || null,
          pais: matched.pais || null,
          nombre_contacto: matched.nombre_contacto || null,
          cargo: matched.cargo || null,
          email: matched.email || null,
          licencia: matched.licencia || null
        };

        await agencyDb.from("contabilidad_proveedores").insert(insertPayload);
        dbProviderIds.add(matched.id);
        return matched.id;
      } catch (err) {
        console.error("Error inserting missing provider on-the-fly:", err);
        return null;
      }
    }

    const resultados: any[] = [];
    for (const legacyCot of toImport) {
      try {
        const servicios = legacyCot.servicios ?? {};
        const lineas = await convertirServicios(servicios, tiposMap, resolveAndEnsureProvider);
        const destinos = (legacyCot.ubicaciones ?? []).map((u: any) => ({
          id: u.id,
          nombre: u.nombre ?? u.id,
        }));

        const resolvedAgente = resolveAgente(legacyCot.usuario_id);

        const { data: nuevaCot, error: errCot } = await agencyDb
          .from("operativa_cotizaciones")
          .insert({
            titulo: legacyCot.titulo || legacyCot.numero || "Importada",
            estado: legacyCot.estado === "aceptada" ? "aceptada" : legacyCot.estado === "enviada" ? "enviada" : "borrador",
            agente_id: resolvedAgente.id,
            contacto: findEntityId(legacyCot.titulo ?? ""),
            pvp_viajero: legacyCot.pvp_viajero ?? 0,
            plazas: legacyCot.plazas ?? 1,
            free: legacyCot.free ?? 0,
            fecha_salida: legacyCot.dia_salida || null,
            fecha_regreso: legacyCot.dia_regreso || null,
            destinos: destinos.length ? destinos : [],
          })
          .select("id")
          .single();

        if (errCot || !nuevaCot) {
          resultados.push({ id: legacyCot.id, titulo: legacyCot.titulo, error: errCot?.message ?? "Error creando cotización" });
          continue;
        }

        const lineasPayload = lineas.map((l: any) => {
          const neto = cleanNumeric(l.neto);
          const pvp = cleanNumeric(l.pvp);
          const rawPlazas = cleanInteger(l.plazas);
          const rawNoches = cleanInteger(l.noches);
          const plazas = (rawPlazas === 0 || rawPlazas === null) ? 1 : rawPlazas;
          const noches = (rawNoches === 0 || rawNoches === null) ? 1 : rawNoches;
          return {
            cotizacion_id: nuevaCot.id,
            tipo: l.tipo,
            descripcion: l.descripcion || "Servicio",
            plazas: plazas,
            noches: noches,
            neto: neto,
            pvp: pvp,
            opcional: l.opcional ?? false,
            checked: l.checked ?? true,
            total_neto: neto * plazas * noches,
            total_pvp: pvp * plazas * noches,
            proveedor: l.proveedor,
          };
        });

        if (lineasPayload.length) {
          const { error: errLineas } = await agencyDb
            .from("operativa_cotizacion_lineas")
            .insert(lineasPayload);
          if (errLineas) {
            resultados.push({
              id: legacyCot.id,
              titulo: legacyCot.titulo,
              error: `Cotización creada pero error en líneas: ${errLineas.message}`,
            });
            continue;
          }
        }

        resultados.push({
          id: legacyCot.id,
          nueva_id: nuevaCot.id,
          titulo: legacyCot.titulo,
          lineas: lineasPayload.length,
          ok: true,
        });
      } catch (e: any) {
        resultados.push({ id: legacyCot.id, titulo: legacyCot.titulo, error: e.message });
      }
    }

    const ok = resultados.filter((r) => r.ok).length;
    return NextResponse.json({
      success: true,
      importadas: ok,
      errores: resultados.filter((r) => r.error).length,
      data: resultados,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

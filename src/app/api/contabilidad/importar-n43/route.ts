import { NextRequest, NextResponse } from 'next/server';
import { N43Parser, MovimientoBancario } from '@/lib/parsers/n43-parser';
import { getAgencyDbClient } from '@/lib/agencyDb';
import { matchMovimientoBancarioConPagos } from '@/actions/banco';

interface MatchResult {
  movimiento_id: string;
  score: number;
  pagador_id: string;
  expediente_id: string;
  pagador_nombre: string;
  entidad_nombre: string;
  detalles: {
    pool1_coincidencias: number;
    pool2_coincidencias: number;
    iban_coincide: boolean;
    fecha_plazo_cercana: boolean;
    importe_cercano: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const cuenta_bancaria_id = formData.get('cuenta_bancaria_id') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No se ha proporcionado ningún archivo.' },
        { status: 400 }
      );
    }

    if (!cuenta_bancaria_id) {
      return NextResponse.json(
        { error: 'El cuenta_bancaria_id es requerido.' },
        { status: 400 }
      );
    }

    // Validación de fichero (.N43 o .n43)
    if (!file.name.toUpperCase().endsWith('.N43')) {
      return NextResponse.json(
        { error: 'Solo se permiten ficheros con extensión .N43' },
        { status: 400 }
      );
    }

    // Obtener cliente de base de datos de la agencia
    const agencyDb = await getAgencyDbClient();

    // 1. Validar cuenta bancaria
    const { data: cuenta, error: cuentaError } = await agencyDb
      .from('config_cuentas_bancarias')
      .select('id')
      .eq('id', cuenta_bancaria_id)
      .maybeSingle();

    if (cuentaError || !cuenta) {
      return NextResponse.json(
        { error: 'La cuenta bancaria seleccionada no es válida o no existe.' },
        { status: 400 }
      );
    }

    // 2. Deduplicación por nombre de archivo y origen
    const { count, error: dupError } = await agencyDb
      .from('contabilidad_movimientos_banco')
      .select('*', { count: 'exact', head: true })
      .eq('fichero_origen', file.name)
      .eq('origen', 'n43');

    if (dupError) {
      console.error('Error checking duplicate import:', dupError);
    }

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Este fichero N43 ya ha sido importado previamente.' },
        { status: 400 }
      );
    }

    // Leer contenido
    const content = await file.text();

    // Parsear N43
    const movimientosParsed = N43Parser.parseFile(content);

    if (movimientosParsed.length === 0) {
      return NextResponse.json(
        { error: 'El fichero N43 no contiene ningún movimiento válido (registros de tipo 22).' },
        { status: 400 }
      );
    }

    // Convertir a MovimientoBancario
    const movimientos = N43Parser.toMovimientosBancarios(
      movimientosParsed,
      cuenta_bancaria_id,
      file.name
    );

    // Guardar en la base de datos de la agencia
    const { error: insertError } = await agencyDb
      .from('contabilidad_movimientos_banco')
      .insert(movimientos.map(m => ({
        id: m.id,
        cuenta_bancaria_id: m.cuenta_bancaria_id,
        fecha_operacion: m.fecha_operacion,
        fecha_valor: m.fecha_valor,
        importe: m.importe,
        concepto_limpio: m.concepto_limpio,
        concepto_original: m.concepto_original,
        moneda: m.moneda,
        origen: m.origen,
        referencia1: m.referencia1,
        referencia2: m.referencia2,
        codigo_operacion: m.codigo_operacion,
        fichero_origen: m.fichero_origen,
        metadatos: m.metadatos,
        estado: m.estado,
        deleted: m.deleted
      })));

    if (insertError) {
      console.error('Error inserting movements into database:', insertError);
      return NextResponse.json(
        { error: `Error al guardar movimientos: ${insertError.message}` },
        { status: 500 }
      );
    }

    // Ejecutar matching automático
    const matches = await matchMovimientos(movimientos, agencyDb);

    // Ejecutar matching automático para pagos de proveedores (importes negativos)
    const negativeMovs = movimientos.filter((m) => m.importe < 0);
    for (const mov of negativeMovs) {
      matchMovimientoBancarioConPagos(mov.id).catch((err) =>
        console.error(`[N43 Import] Error matching negative movement ${mov.id}:`, err)
      );
    }

    return NextResponse.json(
      {
        success: true,
        movimientos_importados: movimientos.length,
        matches_encontrados: matches.length,
        movimientos: movimientos.map((m) => ({
          id: m.id,
          concepto: m.concepto_original,
          metadatos: m.metadatos,
        })),
        matches: matches,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error importing N43:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al importar el fichero N43.' },
      { status: 500 }
    );
  }
}

/**
 * Ejecuta el algoritmo de matching automático
 */
async function matchMovimientos(
  movimientos: MovimientoBancario[],
  agencyDb: any
): Promise<MatchResult[]> {
  const matches: MatchResult[] = [];

  // Obtener todos los pagadores activos con expedientes
  const { data: pagadores, error: pagadoresError } = await agencyDb
    .from('operativa_pagadores_expedientes')
    .select(`
      id,
      expediente_id,
      entidad_id,
      importe_total,
      importe_abonado,
      cuenta_bancaria,
      plazos,
      metadatos_match,
      estado,
      contabilidad_entidades (
        nombre,
        metadatos
      ),
      operativa_expedientes (
        referencia,
        estado
      )
    `)
    .in('estado', ['pendiente', 'parcial', 'completado']);

  if (pagadoresError || !pagadores) {
    console.error('Error fetching pagadores for matching:', pagadoresError);
    return [];
  }

  // Filtrar solo expedientes activos (abierto, confirmado)
  const activePagadores = pagadores.filter((p: any) =>
    p.operativa_expedientes &&
    ['abierto', 'confirmado'].includes(p.operativa_expedientes.estado)
  );

  // Cargar viajeros de todos los expedientes activos para poder hacer match por nombre del alumno
  const expedienteIds = [...new Set(activePagadores.map((p: any) => p.expediente_id).filter(Boolean))];
  let viajerosData: any[] = [];
  if (expedienteIds.length > 0) {
    const { data: vData } = await agencyDb
      .from('operativa_viajeros_expedientes')
      .select(`
        expediente_id, entidad_id, pagador_id, tutor_id,
        contabilidad_entidades!operativa_viajeros_expedientes_entidad_id_fkey(nombre, metadatos)
      `)
      .in('expediente_id', expedienteIds);
    viajerosData = vData || [];
  }

  // Adjuntar viajeros a cada pagador
  // Enlace directo por pagador_id/tutor_id; contingencia por apellido compartido
  // para detectar viajeros familiares cuando el FK no está explícitamente grabado
  const activePagadoresConViajeros = activePagadores.map((p: any) => {
    const pagadorNombre: string = p.contabilidad_entidades?.nombre || "";
    const primerApellido = pagadorNombre.split(/\s+/)[1]?.toLowerCase() || "";
    return {
      ...p,
      viajeros: viajerosData.filter((v: any) => {
        if (v.expediente_id !== p.expediente_id) return false;
        if (v.pagador_id === p.entidad_id || v.tutor_id === p.entidad_id) return true;
        if (primerApellido.length >= 3) {
          const nombreV = (v.contabilidad_entidades?.nombre || "").toLowerCase();
          if (nombreV.includes(primerApellido)) return true;
                const metVF = v.contabilidad_entidades?.metadatos;
          const metVFObj = typeof metVF === "string" ? (() => { try { return JSON.parse(metVF); } catch { return null; } })() : (metVF ?? null);
          const pm: string[] = metVFObj?.palabras_match || [];
          if (pm.includes(primerApellido)) return true;
        }
        return false;
      }),
    };
  });

  // Para cada movimiento, calcular score contra todos los pagadores activos
  for (const mov of movimientos) {
    const movimientoMatches: Array<MatchResult & { score: number }> = [];

    for (const pagador of activePagadoresConViajeros) {
      const score = calcularScore(mov, pagador);

      if (score.total >= 0.4) {
        // Umbral mínimo 40%
        movimientoMatches.push({
          movimiento_id: mov.id,
          score: score.total,
          pagador_id: pagador.id,
          expediente_id: pagador.expediente_id,
          pagador_nombre: pagador.contabilidad_entidades?.nombre || 'Desconocido',
          entidad_nombre: pagador.contabilidad_entidades?.nombre || 'Desconocido',
          detalles: score.detalles,
        });
      }
    }

    // Ordenar por score descendente
    movimientoMatches.sort((a, b) => b.score - a.score);

    if (movimientoMatches.length > 0) {
      // Guardar el mejor match
      const mejorMatch = movimientoMatches[0];

      const { error: updateError } = await agencyDb
        .from('contabilidad_movimientos_banco')
        .update({
          estado: 'propuesto',
          match_score: mejorMatch.score,
          match_propuesto_at: new Date().toISOString(),
          match_metadatos: {
            pagador_id: mejorMatch.pagador_id,
            expediente_id: mejorMatch.expediente_id,
            detalles: mejorMatch.detalles,
            alternativas: movimientoMatches.slice(1, 3), // Top 3
          }
        })
        .eq('id', mov.id);

      if (updateError) {
        console.error(`Error updating bank movement match for ${mov.id}:`, updateError);
      }

      matches.push(mejorMatch);
    }
  }

  return matches;
}

/**
 * Calcula el score de matching entre un movimiento y un pagador
 */
const STOP_WORDS = new Set(["del", "los", "las", "para", "con", "una", "unos", "unas", "por", "que", "les"]);

// Separa por espacios Y por guiones — nunca mezcla los dos pools.
// "alou-portaventuraybarcelona-nicolas" → ["alou", "portaventuraybarcelona", "nicolas"]
function tokenizar(texto: string): string[] {
  return texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[\s,.\-_/;:!?]+/)
    .map(t => t.replace(/[^a-z0-9ñ]/g, ""))
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length > 3 && b.length > 3) return a.includes(b) || b.includes(a);
  return false;
}

/**
 * SCORING ESTRICTO — Separación total de pools:
 *
 *   POOL 1 → identidad del PAGADOR (emisor bancario)
 *   POOL 2 → identidad del VIAJERO (alumno)
 *
 * Matriz de scoring:
 *   Pool1=100% solo                           → 0.70  (homónimo posible)
 *   Pool1=100% + Pool2-viajero = 1 token      → 0.85
 *   Pool1=100% + Pool2-viajero = 2 tokens     → 0.93
 *   Pool1=100% + Pool2-viajero ≥ 3 tokens     → 0.97  (imposible coincidencia)
 *   Pool1= 80-99% + Pool2-viajero ≥ 3         → 0.90
 *   Pool1= 80-99% + Pool2-viajero = 2         → 0.82
 *   Pool1= 80-99% + Pool2-viajero = 1         → 0.74
 *   Pool1= 80-99% solo                        → 0.55
 *   Pool1= 60-79%  (con o sin viajero)        → proporcional ≤ 0.55
 *   Pool1 < 60%                               → descartar
 *
 * Destino del viaje: solo suma cuando score de identidad < 0.85
 */
function calcularScore(
  mov: MovimientoBancario,
  pagador: any
): { total: number; detalles: any } {
  const detalles: Record<string, any> = {
    pool1_coincidencias: 0,
    pool2_viajero_coincidencias: 0,
    pool2_viaje_coincidencias: 0,
    iban_coincide: false,
    fecha_plazo_cercana: false,
    importe_cercano: false,
    certeza: "ninguna",
  };

  // ── 0. IBAN directo → certeza absoluta ───────────────────────────────────
  if (pagador.cuenta_bancaria && mov.concepto_original?.includes(pagador.cuenta_bancaria)) {
    return { total: 1.0, detalles: { ...detalles, iban_coincide: true, certeza: "iban" } };
  }

  // ── Tokens del banco ─────────────────────────────────────────────────────
  // POOL 1: emisor (quien transfiere) — identidad del PAGADOR
  const pool1: string[] = (mov.metadatos?.pool1 || []).map((p: string) => p.toLowerCase());

  // POOL 2: concepto libre — identidad del VIAJERO (nunca mezclar con pool1)
  const pool2Raw: string[] = mov.metadatos?.pool2 || [];
  const pool2Tokens: string[] = [...new Set(pool2Raw.flatMap(tokenizar))];

  const normalizarToken = (t: string) =>
    t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const tokensDeNombre = (nombre: string): string[] =>
    nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .split(/[\s,.()\-]+/)
      .map(t => t.replace(/[^a-z0-9ñ]/g, ""))
      .filter(t => t.length > 1 && !["de", "del", "la", "los", "las", "el", "y", "e", "sl", "sa"].includes(t));

  // metadatos llega como string JSON desde Supabase — parsear antes de acceder
  const parseMetadatos = (m: any) =>
    typeof m === "string" ? (() => { try { return JSON.parse(m); } catch { return null; } })() : (m ?? null);

  // Pagador: metadatos_match.palabras → palabras_match → fallback a nombre
  const pagadorMeta = parseMetadatos(pagador.contabilidad_entidades?.metadatos);
  const pagadorPalabrasRaw: string[] =
    (pagador.metadatos_match?.palabras?.length ? pagador.metadatos_match.palabras :
     pagadorMeta?.palabras_match?.length
       ? pagadorMeta.palabras_match
       : tokensDeNombre(pagador.contabilidad_entidades?.nombre || ""));
  const pagadorTokens: string[] = pagadorPalabrasRaw.map((p: string) => normalizarToken(p));

  // Viajero: palabras_match → fallback a nombre
  const viajerosTokens: string[] = (pagador.viajeros || [])
    .flatMap((v: any) => {
      const vm = parseMetadatos(v.contabilidad_entidades?.metadatos);
      const pm = vm?.palabras_match;
      return Array.isArray(pm) && pm.length > 0
        ? pm as string[]
        : tokensDeNombre(v.contabilidad_entidades?.nombre || "");
    })
    .map((t: string) => normalizarToken(t));

  if (pagadorTokens.length === 0) return { total: 0, detalles };

  // ── CRITERIO 1: Pool1 vs pagador (NUNCA contra viajero) ─────────────────
  let pool1Hits = 0;
  for (const t of pool1) {
    if (pagadorTokens.some(p => tokenMatch(p, t))) pool1Hits++;
  }
  const ratioPool1 = pool1.length > 0 ? pool1Hits / pool1.length : 0;
  detalles.pool1_coincidencias = pool1Hits;

  if (ratioPool1 < 0.6) return { total: 0, detalles }; // Sin identidad mínima del pagador → descartar

  // ── CRITERIO 2: Pool2 vs viajero (NUNCA contra pagador) ─────────────────
  let pool2ViajeroHits = 0;
  if (viajerosTokens.length > 0) {
    for (const t of pool2Tokens) {
      if (viajerosTokens.some(vt => tokenMatch(vt, t))) pool2ViajeroHits++;
    }
  }
  detalles.pool2_viajero_coincidencias = pool2ViajeroHits;

  // ── MATRIZ DE SCORING: pagador × viajero ─────────────────────────────────
  let score = 0;

  if (ratioPool1 >= 1.0) {
    // Pagador identificado al 100%
    if (pool2ViajeroHits >= 3)      { score = 0.97; detalles.certeza = "familia_completa";      }
    else if (pool2ViajeroHits === 2) { score = 0.93; detalles.certeza = "pagador_viajero_alto";  }
    else if (pool2ViajeroHits === 1) { score = 0.85; detalles.certeza = "pagador_viajero_uno";   }
    else                             { score = 0.70; detalles.certeza = "pagador_solo";           }
  } else if (ratioPool1 >= 0.8) {
    // Pagador identificado al 80-99%
    if (pool2ViajeroHits >= 3)      { score = 0.90; detalles.certeza = "pagador_alto_viajero";  }
    else if (pool2ViajeroHits === 2) { score = 0.82; detalles.certeza = "pagador_alto_viajero2"; }
    else if (pool2ViajeroHits === 1) { score = 0.74; detalles.certeza = "pagador_alto_viajero1"; }
    else                             { score = 0.55; detalles.certeza = "pagador_alto_solo";      }
  } else {
    // Pagador débil (60-79%): score proporcional, sin certeza
    const base = ratioPool1 * 0.5 + pool2ViajeroHits * 0.05;
    score = Math.min(base, 0.54);
    detalles.certeza = "debil";
  }

  // ── CRITERIO 3: Destino del viaje — SOLO cuando identidad es débil (<0.85) ──
  if (score < 0.85 && pool2Tokens.length > 0 && pagador.operativa_expedientes?.referencia) {
    const tokensExp = tokenizar(pagador.operativa_expedientes.referencia);
    const viajeHits = pool2Tokens.filter(
      pt => tokensExp.some(et => tokenMatch(et, pt))
    ).length;
    detalles.pool2_viaje_coincidencias = viajeHits;
    if (viajeHits > 0) {
      const bonus = (viajeHits / Math.max(tokensExp.length, 1)) * 0.20;
      score = Math.min(score + bonus, 0.84); // techo 0.84 para que no supere certeza de identidad
    }
  }

  // ── Bonus confirmatorios (±0.02 cada uno) ────────────────────────────────
  if (mov.fecha_operacion && pagador.plazos && Array.isArray(pagador.plazos)) {
    const movDate = new Date(mov.fecha_operacion as string);
    for (const plazo of pagador.plazos) {
      const plazoStr = typeof plazo === "string" ? plazo : plazo?.fecha;
      if (plazoStr) {
        const diffDays = Math.ceil(Math.abs(movDate.getTime() - new Date(plazoStr).getTime()) / 86400000);
        if (diffDays <= 5) { detalles.fecha_plazo_cercana = true; score = Math.min(score + 0.02, 1.0); break; }
      }
    }
  }

  const saldo = Number(pagador.importe_total) - Number(pagador.importe_abonado);
  if (mov.importe && saldo > 0 && Math.abs(Math.abs(mov.importe) - saldo) / saldo < 0.1) {
    detalles.importe_cercano = true;
    score = Math.min(score + 0.02, 1.0);
  }

  return { total: Math.min(score, 1.0), detalles };
}

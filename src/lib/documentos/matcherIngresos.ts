import { getAgencyDbClient } from "@/lib/agencyDb";

export interface MatchResultIngreso {
  pagador_id: string;
  pagador_nombre: string;
  expediente_id: string;
  expediente_referencia: string;
  expediente_numero?: string;
  viajeros: Array<{ id: string; nombre: string }>;
  importe_total: number;
  importe_abonado: number;
  match_score: number;
  razon: string;
  metadatos: {
    criterio_iban: { coincidencia: boolean; score: number };
    criterio_importe: { tipo: "exacto" | "hermanos" | "plazo" | "ninguno"; multiplicador?: number; score: number };
    criterio_concepto: {
      coincidencias_nombres: string[];
      coincidencias_viaje: string[];
      score: number;
    };
    confianza_general: number;
  };
}

export async function buscarMatchesParaIngreso(
  movimiento: {
    id: string;
    importe: number;
    concepto_limpio: string;
    fecha_operacion: Date | string;
    metadatos?: any;
    origen?: string;
    referencia1?: string;
    referencia2?: string;
  },
  pagadoresPendientesPrecalculados?: any[]
): Promise<MatchResultIngreso | null> {
  
  if (!movimiento.concepto_limpio?.trim()) return null;

  const importe = Number(movimiento.importe);
  if (importe <= 0) return null;

  const conceptoUpperCase = movimiento.concepto_limpio.toUpperCase();

  // 1. HIDRATACIÓN SEGURA DE CANDIDATOS
  let candidatos = pagadoresPendientesPrecalculados;
  if (!candidatos) {
    const agencyDb = await getAgencyDbClient();
    
    // Traemos los tutores/pagadores con cuentas pendientes
    const { data: pagadores, error: errorP } = await agencyDb
      .from("operativa_pagadores_expedientes")
      .select(`
        id, expediente_id, entidad_id, importe_total, importe_abonado, cuenta_bancaria, plazos,
        contabilidad_entidades!operativa_pagadores_expedientes_entidad_id_fkey(id, nombre, documento, metadatos),
        operativa_expedientes(id, referencia, numero)
      `)
      .in("estado", ["pendiente", "parcial"]);

    if (errorP || !pagadores) {
      console.error("[Matcher Ingresos] Error al obtener pagadores:", errorP);
      return null;
    }

    // 🎯 CORRECCIÓN CRÍTICA: Traemos los viajeros usando el expediente_id como eje relacional seguro, paginando para saltar el límite de 1000 filas
    const expedienteIds = pagadores.map((p) => p.expediente_id).filter(Boolean);
    let viajerosData: any[] = [];
    
    if (expedienteIds.length > 0) {
      let page = 0;
      const limit = 1000;
      while (true) {
        const { data: vData } = await agencyDb
          .from("operativa_viajeros_expedientes")
          .select(`
            id, expediente_id, entidad_id, tutor_id, pagador_id,
            contabilidad_entidades!operativa_viajeros_expedientes_entidad_id_fkey(id, nombre, metadatos)
          `)
          .in("expediente_id", expedienteIds)
          .range(page * limit, (page + 1) * limit - 1);
        
        if (!vData || vData.length === 0) break;
        viajerosData = viajerosData.concat(vData);
        if (vData.length < limit) break;
        page++;
      }
    }

    // Acoplamos los viajeros que pertenecen a cada pagador/tutor en ese viaje específico
    candidatos = pagadores.map((p) => ({
      ...p,
      operativa_viajeros_expedientes: viajerosData.filter(
        (v) => v.expediente_id === p.expediente_id && (v.pagador_id === p.entidad_id || v.tutor_id === p.entidad_id)
      )
    }));
  }

  if (!candidatos || candidatos.length === 0) return null;

  const posiblesCuentasMovimiento = [
    movimiento.referencia1?.replace(/\s/g, ""),
    movimiento.referencia2?.replace(/\s/g, ""),
  ].filter(Boolean) as string[];

  let mejorMatch: MatchResultIngreso | null = null;
  let mayorScore = -1;

  // Safe parse metadatos (recursive para arreglar JSON doblemente escapado)
  const parseMetadatos = (meta: any) => {
    let parsed = meta;
    while (typeof parsed === 'string') {
      try { 
        const next = JSON.parse(parsed); 
        // Si el resultado de parsear es un número o un string plano, lo dejamos como objeto vacío
        if (typeof next !== 'object' || next === null) break;
        parsed = next;
      } catch (e) { 
        break; 
      }
    }
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  };

  const movMetadatos = parseMetadatos(movimiento.metadatos);

  // Helper de extracción ultra-estricto anti-espacios fantasma y duplicados
  const extraerTokens = (texto: string): string[] => {
    if (!texto) return [];
    const tokensLimpios = texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
      .toUpperCase()
      .split(/[\s,.\-_]+/) // Romper por cualquier tipo de separador o espacios múltiples
      .map(t => t.trim().toLowerCase().replace(/[^a-z0-9ñ]/g, "")) // Limpieza de caracteres extraños
      .filter(t => t.length > 2 && !["DEL", "LOS", "LAS", "SAN", "IES", "PARA", "CONCEPTO"].includes(t.toUpperCase()));

    return [...new Set(tokensLimpios)]; // 🎯 Eliminamos duplicados idénticos en el mismo string
  };

  // 2. FORMATEO DE POOLS (Normalización a minúsculas limpia)
  const pool1: string[] = Array.isArray(movMetadatos.pool1)
    ? extraerTokens(movMetadatos.pool1.join(" "))
    : [];
  const pool2: string[] = Array.isArray(movMetadatos.pool2)
    ? extraerTokens(movMetadatos.pool2.join(" "))
    : [];

  // Si los pools venían vacíos, parseamos el concepto original con el nuevo extractor blindado
  const tokensMovimientoGlobal = pool1.length > 0 || pool2.length > 0 
    ? [...new Set([...pool1, ...pool2])] 
    : extraerTokens(conceptoUpperCase);

  // 3. PROCESAMIENTO DEL SCORING
  for (const c of candidatos) {
    const deuda = Number(c.importe_total) - Number(c.importe_abonado);
    if (deuda <= 0) continue;

    let scoreIban = 0;
    let scoreImporte = 0;
    let scoreConcepto = 0;
    let tipoImporte: "exacto" | "hermanos" | "plazo" | "ninguno" = "ninguno";
    let multiplicadorHermanos: number | undefined;

    const coincidenciasNombres: string[] = [];
    const coincidenciasViaje: string[] = [];

    // --- 🛡️ CRITERIO IBAN ---
    const cuentaPagador = c.cuenta_bancaria?.replace(/\s/g, "");
    if (cuentaPagador && posiblesCuentasMovimiento.some((cta) => cta.includes(cuentaPagador) || cuentaPagador.includes(cta))) {
      scoreIban = 90;
    }

    // --- 🎟️ CRITERIO IMPORTE ---
    const TOLERANCIA = 1.05;

    if (Math.abs(importe - deuda) <= TOLERANCIA) {
      scoreImporte = 40;
      tipoImporte = "exacto";
    } else if (c.plazos && Array.isArray(c.plazos)) {
      for (const plazo of c.plazos) {
        if (Math.abs(importe - Number(plazo.importe || 0)) <= TOLERANCIA) {
          scoreImporte = 40;
          tipoImporte = "plazo";
          break;
        }
      }
    }

    // "Efecto Hermanos"
    if (tipoImporte === "ninguno") {
      const hermanosAprox = Math.round(importe / deuda);
      if (hermanosAprox >= 2 && hermanosAprox <= 4 && Math.abs(importe - (deuda * hermanosAprox)) <= TOLERANCIA) {
        scoreImporte = 30;
        tipoImporte = "hermanos";
        multiplicadorHermanos = hermanosAprox;
      } else if (c.plazos && Array.isArray(c.plazos)) {
         for (const plazo of c.plazos) {
            const pImp = Number(plazo.importe || 0);
            const hPlazo = Math.round(importe / (pImp || 1));
            if (hPlazo >= 2 && hPlazo <= 4 && Math.abs(importe - (pImp * hPlazo)) <= TOLERANCIA) {
              scoreImporte = 30;
              tipoImporte = "hermanos";
              multiplicadorHermanos = hPlazo;
              break;
            }
         }
      }
    }

    // --- 🔤 CRITERIO CONCEPTO SEMÁNTICO (Aislamiento de Canales Estricto) ---
    let palabrasCoincidentesViajero = new Set<string>();
    let palabrasCoincidentesTutor = new Set<string>();

    // 1. EXTRAER PALABRAS CLAVE DE LA FICHA DE LA BASE DE DATOS
    // Normalizar quitando tildes: los tokens N43 llegan sin ellas (banco no las emite),
    // así "nicolás" → "nicolas" y la comparación no falla en silencio.
    const normalizarToken = (t: string) =>
      t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    // Extraer tokens de un nombre directamente cuando no hay palabras_match
    const tokensDeNombre = (nombre: string): string[] =>
      nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
        .split(/[\s,.()\-]+/)
        .map(t => t.replace(/[^a-z0-9ñ]/g, ""))
        .filter(t => t.length > 1 && !["de", "del", "la", "los", "las", "el", "y", "e", "sl", "sa"].includes(t));

    // Viajero: palabras_match → fallback a nombre de la entidad
    const viajeroNombresFicha = c.operativa_viajeros_expedientes
      .flatMap((ve: any) => {
        const meta = parseMetadatos(ve.contabilidad_entidades?.metadatos);
        if (Array.isArray(meta?.palabras_match) && meta.palabras_match.length > 0) {
          return meta.palabras_match as string[];
        }
        return tokensDeNombre(ve.contabilidad_entidades?.nombre || "");
      })
      .map((t: string) => normalizarToken(t));

    // Pagador: metadatos_match.palabras → palabras_match → fallback a nombre de la entidad
    const metadatos_matchPalabras = c.metadatos_match?.palabras || c.metadatos_match?.palabras_match;
    const pagadorMeta = parseMetadatos(c.contabilidad_entidades?.metadatos);
    const tutorNombresFichaRaw: string[] =
      Array.isArray(metadatos_matchPalabras) && metadatos_matchPalabras.length > 0
        ? metadatos_matchPalabras
        : Array.isArray(pagadorMeta?.palabras_match) && pagadorMeta.palabras_match.length > 0
          ? pagadorMeta.palabras_match
          : tokensDeNombre(c.contabilidad_entidades?.nombre || "");
    const tutorNombresFicha = tutorNombresFichaRaw.map((t: string) => normalizarToken(t));

    const matchTokenSafe = (tokenBanco: string, p: string) => {
      if (tokenBanco === p) return true;
      if (tokenBanco.length > 3 && p.length > 3) {
        return tokenBanco.includes(p) || p.includes(tokenBanco);
      }
      return false;
    };

    // 2. 🛡️ EVALUAR VENTANA DEL VIAJERO (Pool2 Exclusivo)
    // El viajero SOLO puede validarse contra el concepto/texto libre del pool2. Prohibido mirar pool1.
    if (pool2.length > 0) {
      viajeroNombresFicha.forEach((p: string) => {
        const existeEnPool2 = pool2.some(tokenBanco => matchTokenSafe(tokenBanco, p));
        if (existeEnPool2) {
          palabrasCoincidentesViajero.add(p);
        }
      });
    } else {
      // Fallback sin pools estructurados: se mantiene el comportamiento global legacy
      const tokensMovimiento = extraerTokens(conceptoUpperCase);
      viajeroNombresFicha.forEach((p: string) => {
        if (tokensMovimiento.some(tokenBanco => matchTokenSafe(tokenBanco, p))) {
          palabrasCoincidentesViajero.add(p);
        }
      });
    }

    // 3. 🛡️ EVALUAR VENTANA DEL TUTOR (Pool1 Exclusivo)
    // El tutor/pagador SOLO puede validarse contra el emisor del pool1. Prohibido mirar pool2.
    if (pool1.length > 0) {
      tutorNombresFicha.forEach((p: string) => {
        const existeEnPool1 = pool1.some(tokenBanco => matchTokenSafe(tokenBanco, p));
        if (existeEnPool1) {
          palabrasCoincidentesTutor.add(p);
        }
      });
    } else {
      const tokensMovimiento = extraerTokens(conceptoUpperCase);
      tutorNombresFicha.forEach((p: string) => {
        if (tokensMovimiento.some(tokenBanco => matchTokenSafe(tokenBanco, p))) {
          palabrasCoincidentesTutor.add(p);
        }
      });
    }

    // 4. 🎯 CÁLCULO DE LA MATRIZ DE CONFIANZA DE GROOMY
    let scoreIdentidad = 0;
    const cantViajero = palabrasCoincidentesViajero.size;
    const cantTutor = palabrasCoincidentesTutor.size;

    const todasLasPalabrasUnicas = new Set([...palabrasCoincidentesViajero, ...palabrasCoincidentesTutor]);
    const totalPalabrasUnicasFamilia = todasLasPalabrasUnicas.size;

    if (totalPalabrasUnicasFamilia <= 1) {
      scoreIdentidad = 0; // Abortamos si solo coincide un apellido común
    } 
    else if (totalPalabrasUnicasFamilia === 2 && cantViajero < 3 && cantTutor < 3) {
      scoreIdentidad = 30; // Coincidencia baja controlada
    } 
    else if (cantTutor >= 3) {
      if (cantViajero === 0 || cantViajero === 1) scoreIdentidad = 80;
      else if (cantViajero === 2) scoreIdentidad = 90;
      else if (cantViajero >= 3) scoreIdentidad = 100;
    } 
    else if (cantViajero >= 3) {
      if (cantTutor === 0 || cantTutor === 1) scoreIdentidad = 80;
      else if (cantTutor === 2) scoreIdentidad = 90;
      else if (cantTutor >= 3) scoreIdentidad = 100;
    } 
    else {
      // Combinaciones parciales seguras (ej: 2 del padre + 1 del niño = 3 únicas)
      scoreIdentidad = (cantViajero * 20) + (cantTutor * 15);
    }

    // 5. VALIDACIÓN DEL DESTINO DEL VIAJE (Solo suma si ya hay una identidad propuesta)
    let scoreViaje = 0;
    if (scoreIdentidad >= 30) {
      const refViaje = c.operativa_expedientes?.referencia || "";
      const tokensViaje = extraerTokens(refViaje).filter(t => !["2024", "2025", "2026", "viaje", "estudios"].includes(t));
      const viajeEncontrado = tokensViaje.filter(t => 
        tokensMovimientoGlobal.some(tkBanco => tkBanco.includes(t) || t.includes(tkBanco))
      );

      if (viajeEncontrado.length > 0) {
        scoreViaje = 5; // Un pequeño extra de 5 puntos para el destino si la identidad acompaña
        coincidenciasViaje.push(...viajeEncontrado);
      }
    }

    scoreConcepto = scoreIdentidad + scoreViaje;
    if (scoreConcepto > 95 && scoreIdentidad < 100) scoreConcepto = 95; // Techo si no es perfecto el nombre

    // --- 📊 AGREGACIÓN DE CONFIDENZA FINALES ---
    let totalScore = scoreIban;

    if (scoreIban === 0) {
      totalScore = scoreConcepto;
      
      // El importe da el empujón final si estamos en el limbo del 90% o 95%
      if (scoreImporte > 0 && totalScore >= 80 && totalScore < 100) {
        totalScore += 5;
      }
    }

    // Cap a 99.99 para evitar error 'numeric field overflow' en DECIMAL(4,2)
    if (totalScore > 99.99) totalScore = 99.99;

    // Umbral mínimo de corte estricto: si el score final no llega a 30, no se propone nada
    if (totalScore < 30) {
      totalScore = 0;
    }

    // Reunimos todas las palabras detectadas para el feedback visual en el Tooltip
    const todasLasCoindicenciasNombres = [...palabrasCoincidentesViajero, ...palabrasCoincidentesTutor];

    if (totalScore > mayorScore && totalScore >= 50) { // Umbral de seguridad elevado a 50
      mayorScore = totalScore;
      
      let razon = "Coincidencia múltiple detectada en el expediente.";
      if (scoreIban > 0) razon = "Match exacto por cuenta bancaria de origen (IBAN conocido).";
      else if (tipoImporte === "hermanos") razon = `El importe es exactamente ${multiplicadorHermanos}x veces la cuota esperada, con coincidencia familiar.`;
      else if (tipoImporte === "exacto" && scoreIdentidad > 0) razon = "Importe exacto y coincidencia en la identidad familiar.";
      else if (tipoImporte === "plazo") razon = "El importe coincide exactamente con un plazo de cobro del viaje.";
      else if (scoreIdentidad >= 80) razon = "Certeza absoluta de identidad por coincidencia masiva de palabras clave de la familia.";
      else if (scoreIdentidad >= 30) razon = "Coincidencia fuerte por nombres/apellidos en el pool del extracto.";

      mejorMatch = {
        pagador_id: c.entidad_id,
        pagador_nombre: c.contabilidad_entidades?.nombre || "Desconocido",
        expediente_id: c.expediente_id,
        expediente_referencia: c.operativa_expedientes?.referencia || "",
        expediente_numero: c.operativa_expedientes?.numero || "",
        viajeros: c.operativa_viajeros_expedientes.map((v: any) => ({
          id: v.entidad_id,
          nombre: v.contabilidad_entidades?.nombre || "Viajero",
        })),
        importe_total: Number(c.importe_total),
        importe_abonado: Number(c.importe_abonado),
        match_score: totalScore,
        razon,
        metadatos: {
          criterio_iban: { coincidencia: scoreIban > 0, score: scoreIban },
          criterio_importe: { tipo: tipoImporte, multiplicador: multiplicadorHermanos, score: scoreImporte },
          criterio_concepto: { 
            coincidencias_nombres: todasLasCoindicenciasNombres, 
            coincidencias_viaje: [...new Set(coincidenciasViaje)], 
            score: scoreConcepto 
          },
          confianza_general: totalScore
        }
      };
    }
  }

  return mejorMatch;
}

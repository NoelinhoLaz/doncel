/**
 * Parser N43 - Norma 43 del Banco de España
 * Convierte ficheros N43 a objetos MovimientoBancario
 */

export interface MovimientoBancario {
  id: string;
  cuenta_bancaria_id: string;
  fecha_operacion: string | null; // Formato YYYY-MM-DD
  fecha_valor: string | null;     // Formato YYYY-MM-DD
  importe: number;
  concepto_limpio: string;
  concepto_original: string;
  moneda: string;
  origen: 'n43' | 'bridge';
  referencia1: string;
  referencia2: string;
  codigo_operacion: string;
  fichero_origen: string;
  metadatos: {
    pool1: string[];
    pool2: string[];
  };
  estado: 'pendiente' | 'propuesto' | 'conciliado' | 'descartado' | 'futuro';
  deleted: boolean;
  created_at?: string;
}

export interface ParsedMovimiento {
  concepto: string;
  referencia1: string;
  referencia2: string;
  codigo_operacion: string;
  fecha_operacion: Date | null;
  fecha_valor: Date | null;
  importe: number;
}

export class N43Parser {
  /**
   * Parsea un fichero N43 en formato texto
   */
  static parseFile(content: string): ParsedMovimiento[] {
    const lineas = content.split(/\r?\n/);
    const movimientos: ParsedMovimiento[] = [];
    let movimientoActual: ParsedMovimiento | null = null;

    for (const linea of lineas) {
      if (!linea || linea.length < 2) continue;

      const tipo = linea.substring(0, 2);

      if (tipo === '22') {
        // Nuevo movimiento
        if (movimientoActual) {
          movimientos.push(movimientoActual);
        }

        movimientoActual = this.parseLinea22(linea);
      } else if (tipo === '23' && movimientoActual) {
        // Concepto
        this.parseLinea23(linea, movimientoActual);
      }
    }

    // Guardar último movimiento
    if (movimientoActual) {
      movimientos.push(movimientoActual);
    }

    return movimientos;
  }

  /**
   * Parsea una línea tipo 22 (movimiento)
   */
  private static parseLinea22(linea: string): ParsedMovimiento {
    let fechaOperacion: Date | null = null;
    let fechaValor: Date | null = null;
    let importe = 0;

    try {
      // Extraer fecha de operación (posiciones 11 a 16: YYMMDD)
      if (linea.length >= 16) {
        const yy = parseInt(linea.substring(10, 12));
        const mm = parseInt(linea.substring(12, 14)) - 1;
        const dd = parseInt(linea.substring(14, 16));
        if (!isNaN(yy) && !isNaN(mm) && !isNaN(dd)) {
          fechaOperacion = new Date(Date.UTC(2000 + yy, mm, dd));
        }
      }

      // Extraer fecha de valor (posiciones 17 a 22: YYMMDD)
      if (linea.length >= 22) {
        const vy = parseInt(linea.substring(16, 18));
        const vm = parseInt(linea.substring(18, 20)) - 1;
        const vd = parseInt(linea.substring(20, 22));
        if (!isNaN(vy) && !isNaN(vm) && !isNaN(vd)) {
          fechaValor = new Date(Date.UTC(2000 + vy, vm, vd));
        }
      }

      // Extraer signo (posición 28) e importe (posiciones 29 a 42: 14 dígitos con 2 decimales implícitos)
      if (linea.length >= 42) {
        const signChar = linea.substring(27, 28);
        const rawImporte = parseFloat(linea.substring(28, 42));
        if (!isNaN(rawImporte)) {
          // 1: Debe (cargo/negativo), 2: Haber (abono/positivo)
          const sign = signChar === '1' ? -1 : 1;
          importe = (rawImporte / 100) * sign;
        }
      }
    } catch (e) {
      console.error("Error al parsear campos del registro 22:", e);
    }

    return {
      concepto: '',
      referencia1: linea.length >= 64 ? linea.substring(52, 64).trim() : (linea.length > 52 ? linea.substring(52).trim() : ''),
      referencia2: linea.length >= 80 ? linea.substring(64, 80).trim() : (linea.length > 64 ? linea.substring(64).trim() : ''),
      codigo_operacion: linea.length >= 27 ? linea.substring(24, 27).trim() : '',
      fecha_operacion: fechaOperacion,
      fecha_valor: fechaValor,
      importe
    };
  }

  /**
   * Parsea una línea tipo 23 (concepto) y la añade al movimiento
   */
  private static parseLinea23(
    linea: string,
    movimiento: ParsedMovimiento
  ): void {
    const concepto =
      linea.length >= 104
        ? linea.substring(4, 104).trim()
        : linea.substring(4).trim();

    if (!movimiento.concepto) {
      movimiento.concepto = concepto;
    } else {
      movimiento.concepto += ' ' + concepto;
    }
  }

  /**
   * Convierte movimientos parseados a objetos MovimientoBancario
   */
  static toMovimientosBancarios(
    movimientos: ParsedMovimiento[],
    cuenta_bancaria_id: string,
    fichero_origen: string
  ): MovimientoBancario[] {
    const formatDateStr = (d: Date | null): string | null => {
      if (!d) return null;
      return d.toISOString().split('T')[0];
    };

    return movimientos
      .filter((mov) => mov.concepto.length > 0)
      .map((mov) => ({
        id: this.generateUUID(),
        cuenta_bancaria_id,
        fecha_operacion: formatDateStr(mov.fecha_operacion),
        fecha_valor: formatDateStr(mov.fecha_valor),
        importe: mov.importe,
        concepto_limpio: mov.concepto.substring(0, 500),
        concepto_original: mov.concepto.substring(0, 500),
        moneda: 'EUR',
        origen: 'n43',
        referencia1: mov.referencia1.substring(0, 20),
        referencia2: mov.referencia2.substring(0, 20),
        codigo_operacion: mov.codigo_operacion.substring(0, 3),
        fichero_origen,
        metadatos: this.extraerPools(mov.concepto),
        estado: 'pendiente',
        deleted: false
      }));
  }

  /**
   * Extrae pool1 (emisor) y pool2 (concepto) del texto
   */
  static extraerPools(concepto: string): {
    pool1: string[];
    pool2: string[];
  } {
    const metadatos: { pool1: string[]; pool2: string[] } = {
      pool1: [],
      pool2: [],
    };

    // Patrón: TRANSFERENCIA (INMEDIATA) DE/A FAVOR DE X CONCEPTO Y
    const match = concepto.match(
      /TRANSFERENCIA\s+(?:INMEDIATA\s+)?(?:DE|A\s+FAVOR\s+DE)\s+(.+?)(?:\s+CONCEPTO\s*:?|$)/i
    );

    if (match) {
      const pool1Texto = match[1].replace(/[,.:]/g, '');
      metadatos.pool1 = pool1Texto
        .split(/\s+/)
        .filter((p) => p.length > 1)
        .map((p) => p.toLowerCase());

      // Pool2: texto después de "CONCEPTO"
      const conceptoPos = concepto.toUpperCase().indexOf('CONCEPTO');
      if (conceptoPos !== -1) {
        const pool2Texto = concepto
          .substring(conceptoPos + 8)
          .replace(/[,.:]/g, '');
        metadatos.pool2 = pool2Texto
          .split(/\s+/)
          .filter((p) => p.length > 1)
          .map((p) => p.toLowerCase());
      }
    } else {
      // Intentar una extracción simple por si acaso el concepto no tiene el formato estándar
      // Por ejemplo, cualquier palabra del concepto
      const palabras = concepto.replace(/[,.:]/g, '').split(/\s+/).filter(p => p.length > 1).map(p => p.toLowerCase());
      metadatos.pool1 = palabras;
    }

    return metadatos;
  }

  /**
   * Genera un UUID v4
   */
  private static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

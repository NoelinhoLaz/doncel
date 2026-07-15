import { NextRequest, NextResponse } from 'next/server';
import { getAgencyDbClient } from '@/lib/agencyDb';
import { recalcularEstadoMovimientoBanco } from '@/lib/conciliacion/contabilidadService';

interface ConciliacionRequest {
  movimiento_banco_id: string;
  pagador_id: string;
  expediente_id: string;
  conciliacion_tipo?: 'automatica' | 'manual';
}

export async function POST(request: NextRequest) {
  try {
    const body: ConciliacionRequest = await request.json();
    const {
      movimiento_banco_id,
      pagador_id,
      expediente_id,
      conciliacion_tipo = 'automatica',
    } = body;

    if (!movimiento_banco_id || !pagador_id || !expediente_id) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (movimiento_banco_id, pagador_id, expediente_id).' },
        { status: 400 }
      );
    }

    const agencyDb = await getAgencyDbClient();

    // 1. Obtener datos del movimiento bancario
    const { data: movimiento, error: movError } = await agencyDb
      .from('contabilidad_movimientos_banco')
      .select('*')
      .eq('id', movimiento_banco_id)
      .maybeSingle();

    if (movError || !movimiento) {
      return NextResponse.json(
        { error: 'Movimiento bancario no encontrado.' },
        { status: 404 }
      );
    }

    // 2. Obtener datos del pagador (robusto contra ID de registro o ID de entidad)
    let pagador = null;
    let pagadorError = null;

    const { data: pByRecordId, error: err1 } = await agencyDb
      .from('operativa_pagadores_expedientes')
      .select('*')
      .eq('id', pagador_id)
      .maybeSingle();

    if (pByRecordId) {
      pagador = pByRecordId;
    } else {
      const { data: pByEntidadId, error: err2 } = await agencyDb
        .from('operativa_pagadores_expedientes')
        .select('*')
        .eq('entidad_id', pagador_id)
        .eq('expediente_id', expediente_id)
        .maybeSingle();
      pagador = pByEntidadId;
      pagadorError = err2 || err1;
    }

    if (pagadorError || !pagador) {
      return NextResponse.json(
        { error: 'Pagador del expediente no encontrado.' },
        { status: 404 }
      );
    }

    // 3. Crear movimiento contable (contabilidad_movimientos)
    const tipo = movimiento.importe >= 0 ? 'cobro' : 'pago';
    const { data: movimientoContable, error: contableError } = await agencyDb
      .from('contabilidad_movimientos')
      .insert([{
        entidad_id: pagador.entidad_id,
        usuario_id: '550e8400-e29b-41d4-a716-446655440000',
        tipo: tipo,
        importe_total: Math.abs(movimiento.importe),
        moneda: movimiento.moneda || 'EUR',
        medio_pago: determinaMedioPago(movimiento.concepto_original || ''),
        tipo_servicio: movimiento.concepto_original?.substring(0, 50) || null,
        fecha: movimiento.fecha_operacion || new Date().toISOString().split('T')[0],
        concepto: movimiento.concepto_original?.substring(0, 500) || 'Movimiento conciliado N43',
        estado: 'confirmado',
        movimiento_banco_id: movimiento.id
      }])
      .select('id')
      .single();

    if (contableError || !movimientoContable) {
      console.error('Error creating contable movement:', contableError);
      return NextResponse.json(
        { error: `Error al registrar el movimiento contable: ${contableError?.message}` },
        { status: 500 }
      );
    }

    // 4. Insertar apuntes contables en estado pendiente (sin asiento)
    const apunteId = await insertarApuntesPendientes(movimientoContable.id, movimiento, pagador, agencyDb, expediente_id);

    // 5. Recalcular estado del movimiento bancario (conciliado o parcial según importe cubierto)
    await recalcularEstadoMovimientoBanco(agencyDb, movimiento_banco_id, conciliacion_tipo);

    const { error: updateApunteError } = await agencyDb
      .from('contabilidad_movimientos_banco')
      .update({ apunte_id: apunteId })
      .eq('id', movimiento_banco_id);

    if (updateApunteError) {
      console.error('Error updating bank movement apunte_id:', updateApunteError);
    }

    // 6. Crear imputaciones a viajeros del expediente (priorizando los del match_metadatos)
    let viajerosImputar: string[] = [];
    const meta = movimiento.match_metadatos as any;

    if (meta?.viajeros && Array.isArray(meta.viajeros) && meta.viajeros.length > 0) {
      viajerosImputar = meta.viajeros.map((v: any) => v.id).filter(Boolean);
    }

    if (viajerosImputar.length === 0) {
      const { data: travelers, error: travelersError } = await agencyDb
        .from('operativa_viajeros_expedientes')
        .select('entidad_id')
        .eq('expediente_id', expediente_id)
        .neq('estado', 'cancelado')
        .neq('estado', 'anulado');

      if (travelersError) {
        console.error('Error fetching travelers for fallback imputations:', travelersError);
      } else if (travelers) {
        viajerosImputar = travelers.map((row: any) => row.entidad_id).filter(Boolean);
      }
    }

    if (viajerosImputar.length > 0) {
      const importePorViajero = Math.abs(movimiento.importe) / viajerosImputar.length;
      const { error: impError } = await agencyDb
        .from('contabilidad_movimientos_imputaciones')
        .insert(viajerosImputar.map((vId: string) => ({
          movimiento_id: movimientoContable.id,
          expediente_id: expediente_id,
          viajero_id: vId,
          importe: parseFloat(importePorViajero.toFixed(2))
        })));

      if (impError) {
        console.error('Error creating traveler imputations:', impError);
      }
    }

    // 7. Actualizar pagador saldo abonado y estado
    const nuevoAbonado = Number(pagador.importe_abonado) + Math.abs(movimiento.importe);
    const nuevoEstado =
      nuevoAbonado >= Number(pagador.importe_total)
        ? 'completado'
        : nuevoAbonado > 0
          ? 'parcial'
          : 'pendiente';

    const { error: updatePagadorError } = await agencyDb
      .from('operativa_pagadores_expedientes')
      .update({
        importe_abonado: nuevoAbonado,
        estado: nuevoEstado,
        updated_at: new Date().toISOString()
      })
      .eq('id', pagador_id);

    if (updatePagadorError) {
      console.error('Error updating pagador balance:', updatePagadorError);
    }

    return NextResponse.json({
      success: true,
      movimiento_conciliado: movimiento_banco_id,
      movimiento_contable_id: movimientoContable.id,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error in conciliate movement:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al conciliar el movimiento.' },
      { status: 500 }
    );
  }
}

/**
 * Inserta apuntes contables en estado pendiente (asiento_id = NULL)
 * usando la fecha real del movimiento bancario. Retorna el ID del primer apunte.
 */
async function insertarApuntesPendientes(
  movimientoContableId: string,
  movimientoBanco: any,
  pagador: any,
  agencyDb: any,
  expedienteId: string
): Promise<string | null> {
  // 1. Obtener subcuentas contables del cliente/pagador
  let cuentasContablesCliente: any = null;
  let clienteNombre = 'Cliente';
  if (pagador?.entidad_id) {
    const { data: entData } = await agencyDb
      .from('contabilidad_entidades')
      .select('nombre, cuentas_contables')
      .eq('id', pagador.entidad_id)
      .maybeSingle();

    if (entData) {
      clienteNombre = entData.nombre;
      cuentasContablesCliente = entData.cuentas_contables || null;
    }
  }

  const subcuentaCliente: string | null = cuentasContablesCliente?.cuenta_cliente
    || cuentasContablesCliente?.cliente
    || null;

  if (!subcuentaCliente || subcuentaCliente.trim() === '') {
    console.warn(`El tutor/pagador ${pagador.entidad_id} no cuenta con una subcuenta contable de cliente válida. Usando cuenta genérica 430.`);
  }

  const subcuentaClienteLimpia = subcuentaCliente || '43000010000';
  const codigoAnticipoCalculado = '438' + subcuentaClienteLimpia.substring(3);

  // 2. Determinar cuentas contables según medio de pago y tipo
  const { data: cuentaBancaria } = await agencyDb
    .from('config_cuentas_bancarias')
    .select('cuenta_contable')
    .eq('id', movimientoBanco.cuenta_bancaria_id)
    .maybeSingle();

  const tipo = movimientoBanco.importe >= 0 ? 'cobro' : 'pago';
  const medioPago = determinaMedioPago(movimientoBanco.concepto_original || '');

  let cuentaBancoCodigo = cuentaBancaria?.cuenta_contable || '572';
  if (medioPago === 'efectivo') {
    cuentaBancoCodigo = '570';
  }

  const fechaOperacion = movimientoBanco.fecha_operacion || new Date().toISOString().split('T')[0];
  const importe = Math.abs(movimientoBanco.importe);
  const conceptoLimpioBanco = movimientoBanco.concepto_limpio || movimientoBanco.concepto_original || '';

  // Para cobro: Debe Banco, Haber Anticipo Cliente (438...)
  // Para pago: Debe Anticipo Cliente (438...), Haber Banco
  const cuentaDebeCodigo = tipo === 'cobro' ? cuentaBancoCodigo : codigoAnticipoCalculado;
  const cuentaHaberCodigo = tipo === 'cobro' ? codigoAnticipoCalculado : cuentaBancoCodigo;

  // Resolver códigos a UUIDs en config_cuentas_contables
  const { data: cuentasContables } = await agencyDb
    .from('config_cuentas_contables')
    .select('id, codigo')
    .in('codigo', [cuentaDebeCodigo, cuentaHaberCodigo]);

  let uuidDebe = cuentasContables?.find((c: any) => c.codigo === cuentaDebeCodigo)?.id;
  let uuidHaber = cuentasContables?.find((c: any) => c.codigo === cuentaHaberCodigo)?.id;

  if (!uuidDebe || !uuidHaber) {
    console.warn(`Cuentas contables ${cuentaDebeCodigo} o ${cuentaHaberCodigo} no encontradas en config_cuentas_contables. Ejecutando fallback.`);
    const { data: fallbackCuentas } = await agencyDb
      .from('config_cuentas_contables')
      .select('id')
      .limit(2);

    uuidDebe = uuidDebe || fallbackCuentas?.[0]?.id;
    uuidHaber = uuidHaber || fallbackCuentas?.[1]?.id || fallbackCuentas?.[0]?.id;
  }

    if (uuidDebe && uuidHaber) {
      const subcuentaDebe = cuentaDebeCodigo === codigoAnticipoCalculado ? codigoAnticipoCalculado : cuentaBancoCodigo;
      const subcuentaHaber = cuentaHaberCodigo === codigoAnticipoCalculado ? codigoAnticipoCalculado : cuentaBancoCodigo;

      const apuntes = [
        {
          asiento_id: null,
          fecha: fechaOperacion,
          cuenta_id: uuidDebe,
          entidad_id: pagador.entidad_id,
          subcuenta: subcuentaDebe,
          debe: tipo === 'cobro' ? importe : 0,
          haber: tipo === 'cobro' ? 0 : importe,
          concepto: `I/ Conciliación banco - ${conceptoLimpioBanco.substring(0, 70)}`
        },
        {
          asiento_id: null,
          fecha: fechaOperacion,
          cuenta_id: uuidHaber,
          entidad_id: pagador.entidad_id,
          subcuenta: subcuentaHaber,
          debe: tipo === 'cobro' ? 0 : importe,
          haber: tipo === 'cobro' ? importe : 0,
          concepto: `U/ Anticipo viaje - ${clienteNombre}`
        }
      ];

      const { data: apuntesCreados, error: apError } = await agencyDb
        .from('contabilidad_apuntes')
        .insert(apuntes)
        .select('id');

      if (apError) {
        console.error('Error creating ledger apuntes pendientes:', apError);
        return null;
      }

      return apuntesCreados?.[0]?.id || null;
    } else {
      console.error('No se pudieron resolver cuentas contables de fallback. No se insertaron apuntes.');
      return null;
    }
}

/**
 * Determina el medio de pago desde el concepto bancario
 */
function determinaMedioPago(concepto: string): 'banco' | 'efectivo' | 'tarjeta' | 'online' {
  const c = concepto.toUpperCase();
  if (c.includes('TARJETA')) return 'tarjeta';
  if (c.includes('ONLINE') || c.includes('PAYPAL')) return 'online';
  if (c.includes('TRANSFERENCIA') || c.includes('INGRESO') || c.includes('BIZUM')) return 'banco';
  if (c.includes('EFECTIVO')) return 'efectivo';
  return 'banco';
}

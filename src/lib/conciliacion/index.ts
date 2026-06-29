import { ejecutarMotorCobrosClientes } from "./motorCobrosClientes";
import { ejecutarMotorServiciosGastos } from "./motorServiciosGastos";
import { ejecutarMotorReembolsosClientes } from "./motorReembolsosClientes";
import { ejecutarMotorReembolsosProveedores } from "./motorReembolsosProveedores";

export async function procesarConciliacionGroomy(movimiento: any, datosBD: any) {
  const importe = movimiento.importe;
  const concepto = (movimiento.concepto_original || movimiento.concepto_limpio || "").toLowerCase();

  // 1. REEMBOLSOS DE PROVEEDORES (+)
  if (importe > 0 && (concepto.includes("abono") || concepto.includes("reembolso") || concepto.includes("refund"))) {
    return ejecutarMotorReembolsosProveedores(movimiento, datosBD.abonosProveedores);
  }

  // 2. COBROS DE CLIENTES (+)
  if (importe > 0) {
    return ejecutarMotorCobrosClientes(movimiento, datosBD.expedientesClientes);
  }

  // 3. PAGOS NEGATIVOS QUE SON PROVEEDORES: derivar primero al motor de servicios.
  if (importe < 0 && /(aviacion|avial|vuelos)/.test(concepto)) {
    return ejecutarMotorServiciosGastos(movimiento, datosBD.facturasProveedores);
  }

  // 4. REEMBOLSOS A CLIENTES (-)
  if (importe < 0 && (concepto.includes("reembolso") || concepto.includes("devolucion") || concepto.includes("abono"))) {
    return ejecutarMotorReembolsosClientes(movimiento, datosBD.ordenesReembolso);
  }

  // 5. SERVICIOS / GASTOS DE PROVEEDORES (-)
  if (importe < 0) {
    return ejecutarMotorServiciosGastos(movimiento, datosBD.facturasProveedores);
  }

  return null;
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Search, ChevronDown, X } from "lucide-react";
import { getDetalleProcesoOfiviaje, guardarAliasProveedor, reprocesarFicheroOfiviaje, getMovimientosBanco } from "@/actions/banco";
import { getCuentasBancarias } from "@/actions/cuentasBancarias";

interface Procesado {
  movimientoId: string;
  movimientoFecha: string;
  movimientoFechaValor: string | null;
  movimientoConcepto: string;
  movimientoImporte: number;
  ofiImporte: number | null;
  proveedorNombre: string;
  expediente: string;
  documento: string | null;
  documentoCobroPago: string | null;
  nombrePasajero: string | null;
  fechaVencto: string | null;
  fechaDoc: string | null;
  cuentaBancariaId: string | null;
  cuentaBancariaNombre: string | null;
}

interface Tarea {
  id: string;
  tipo: string;
  nombre: string;
  expediente: string;
  importe: number | null;
  documento: string | null;
  documentoCobroPago: string | null;
  nombrePasajero: string | null;
  fechaVencto: string | null;
  fechaDoc: string | null;
  movConcepto: string | null;
  movImporte: number | null;
  movFecha: string | null;
  movFechaValor: string | null;
  resuelta: boolean;
  cuentaBancariaId: string | null;
  cuentaBancariaNombre: string | null;
}

const ETIQUETA_TIPO: Record<string, string> = {
  revisarNombre: "Cliente/Proveedor distinto",
  revisarImporte: "Importe distinto",
  revisarSuma: "Suma de movimientos",
  revisarDivision: "División de pagos",
  sinMatch: "Movimiento bancario no encontrado",
};

const formatoImporte = (valor: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Math.abs(valor));

const parseFechaUtc = (valor: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(valor) ? valor : `${valor}Z`);

const formatoFechaCorta = (valor: string | null) => {
  if (!valor) return "";
  const [y, m, d] = valor.split("-");
  return d && m && y ? `${d}/${m}/${y.slice(-2)}` : valor;
};

// fechaVencto/fechaDoc del XML ya vienen "dd/mm/yyyy"; solo se recorta el año.
const formatoFechaXml = (valor: string | null) => {
  if (!valor) return "";
  const partes = valor.split("/");
  return partes.length === 3 ? `${partes[0]}/${partes[1]}/${partes[2].slice(-2)}` : valor;
};

const POR_PAGINA = 10;

function TooltipDatosXml({ children, datos }: { children: React.ReactNode; datos: { label: string; valor: string | null }[] }) {
  const [show, setShow] = useState(false);
  const visibles = datos.filter((d) => d.valor);
  if (visibles.length === 0) return <>{children}</>;

  return (
    <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: "0.3rem",
            zIndex: 50,
            background: "#0f172a",
            color: "#e2e8f0",
            borderRadius: "0.5rem",
            padding: "0.6rem 0.75rem",
            fontSize: "0.75rem",
            whiteSpace: "nowrap",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
            pointerEvents: "none",
          }}
        >
          {visibles.map((d) => (
            <div key={d.label}>
              <span style={{ color: "#94a3b8" }}>{d.label}:</span> {d.valor}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownCuentas({
  cuentas,
  seleccionadas,
  onChange,
}: {
  cuentas: { id: string; nombre: string }[];
  seleccionadas: string[];
  onChange: (ids: string[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  if (cuentas.length <= 1) return null;

  const toggle = (id: string) => {
    onChange(seleccionadas.includes(id) ? seleccionadas.filter((s) => s !== id) : [...seleccionadas, id]);
  };

  const etiqueta =
    seleccionadas.length === 0
      ? "Todas las cuentas"
      : seleccionadas.length === 1
        ? cuentas.find((c) => c.id === seleccionadas[0])?.nombre || "1 cuenta"
        : `${seleccionadas.length} cuentas`;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.45rem 0.6rem",
          fontSize: "0.8rem",
          color: "#334155",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "0.375rem",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {etiqueta}
        <ChevronDown size={14} />
      </button>
      {abierto && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setAbierto(false)} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              zIndex: 11,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "0.5rem",
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
              padding: "0.4rem",
              minWidth: "200px",
            }}
          >
            {cuentas.map((c) => (
              <label
                key={c.id}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.4rem", fontSize: "0.8rem", cursor: "pointer" }}
              >
                <input type="checkbox" checked={seleccionadas.includes(c.id)} onChange={() => toggle(c.id)} />
                {c.nombre}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DropdownTipos({
  tipos,
  seleccionados,
  onChange,
}: {
  tipos: string[];
  seleccionados: string[];
  onChange: (tipos: string[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  if (tipos.length <= 1) return null;

  const toggle = (tipo: string) => {
    onChange(seleccionados.includes(tipo) ? seleccionados.filter((s) => s !== tipo) : [...seleccionados, tipo]);
  };

  const etiqueta =
    seleccionados.length === 0
      ? "Todos los tipos"
      : seleccionados.length === 1
        ? ETIQUETA_TIPO[seleccionados[0]] || seleccionados[0]
        : `${seleccionados.length} tipos`;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.45rem 0.6rem",
          fontSize: "0.8rem",
          color: "#334155",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "0.375rem",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {etiqueta}
        <ChevronDown size={14} />
      </button>
      {abierto && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setAbierto(false)} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              zIndex: 11,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "0.5rem",
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
              padding: "0.4rem",
              minWidth: "220px",
            }}
          >
            {tipos.map((tipo) => (
              <label
                key={tipo}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.4rem", fontSize: "0.8rem", cursor: "pointer" }}
              >
                <input type="checkbox" checked={seleccionados.includes(tipo)} onChange={() => toggle(tipo)} />
                {ETIQUETA_TIPO[tipo] || tipo}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ModalBuscarMovimiento({ tarea, onClose }: { tarea: Tarea; onClose: () => void }) {
  const [texto, setTexto] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [importeMin, setImporteMin] = useState("");
  const [importeMax, setImporteMax] = useState("");
  const [tipoMovimiento, setTipoMovimiento] = useState<"" | "debe" | "haber">("");
  const [cuentaId, setCuentaId] = useState("");
  const [cuentas, setCuentas] = useState<{ id: string; banco: string }[]>([]);
  const [resultados, setResultados] = useState<any[]>([]);
  const [totalResultados, setTotalResultados] = useState(0);
  const [paginaResultados, setPaginaResultados] = useState(1);
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const RESULTADOS_POR_PAGINA = 100;

  useEffect(() => {
    getCuentasBancarias().then((data: any) => setCuentas(data || []));
  }, []);

  // El importe se introduce siempre en positivo (como en OFI); como
  // contabilidad_movimientos_banco guarda el importe con signo (negativo para
  // pagos/Debe, positivo para cobros/Haber), se traduce aquí el rango
  // positivo introducido al rango real según el signo esperado, para que
  // buscar "de 450 a 452" encuentre un movimiento de -451 sin que el usuario
  // tenga que invertir ni negar los valores.
  const buscar = async (pagina: number = 1) => {
    setBuscando(true);
    try {
      const min = importeMin ? Number(importeMin) : undefined;
      const max = importeMax ? Number(importeMax) : undefined;

      let importeMinReal: number | undefined;
      let importeMaxReal: number | undefined;

      if (tipoMovimiento === "debe") {
        importeMinReal = max != null ? -max : undefined;
        importeMaxReal = min != null ? -min : undefined;
      } else {
        // Haber, o sin signo indicado: se asume positivo (Haber). Para
        // buscar un pago (Debe) hay que seleccionar explícitamente "Debe".
        importeMinReal = min;
        importeMaxReal = max;
      }

      const { data, count } = await getMovimientosBanco({
        search: texto.trim() || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        importeMin: importeMinReal,
        importeMax: importeMaxReal,
        tipoMovimiento: tipoMovimiento || undefined,
        cuentaIds: cuentaId ? [cuentaId] : undefined,
        page: pagina,
        limit: RESULTADOS_POR_PAGINA,
      });
      setResultados(data);
      setTotalResultados(count || 0);
      setPaginaResultados(pagina);
      setBuscado(true);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div
        style={{ background: "#fff", borderRadius: "0.6rem", padding: "1.25rem", width: "min(640px, 92vw)", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Buscar movimiento bancario</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "0.4rem" }}>Datos OFI</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem 1rem", fontSize: "0.8rem" }}>
            {[
              { label: "Proveedor", valor: tarea.nombre },
              { label: "Expediente OFI", valor: tarea.expediente },
              { label: "Importe", valor: tarea.importe != null ? formatoImporte(tarea.importe) : null },
              { label: "Documento", valor: tarea.documento },
              { label: "Doc. cobro/pago", valor: tarea.documentoCobroPago },
              { label: "Pasajero", valor: tarea.nombrePasajero },
              { label: "Fecha vencto", valor: tarea.fechaVencto },
              { label: "Fecha doc", valor: tarea.fechaDoc },
            ]
              .filter((d) => d.valor)
              .map((d) => (
                <div key={d.label}>
                  <span style={{ color: "#94a3b8" }}>{d.label}:</span> <span style={{ color: "#334155", fontWeight: 600 }}>{d.valor}</span>
                </div>
              ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="Buscar por concepto..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            style={{ width: "100%", padding: "0.5rem 0.6rem", fontSize: "0.85rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", boxSizing: "border-box" }}
          />
          <label style={{ fontSize: "0.75rem", color: "#64748b" }}>
            Cuenta bancaria
            <select
              value={cuentaId}
              onChange={(e) => setCuentaId(e.target.value)}
              style={{ width: "100%", padding: "0.4rem 0.5rem", fontSize: "0.85rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", boxSizing: "border-box", marginTop: "0.2rem" }}
            >
              <option value="">Todas las cuentas</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.banco}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <label style={{ flex: 1, fontSize: "0.75rem", color: "#64748b" }}>
              Fecha desde
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                style={{ width: "100%", padding: "0.4rem 0.5rem", fontSize: "0.85rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", boxSizing: "border-box", marginTop: "0.2rem" }}
              />
            </label>
            <label style={{ flex: 1, fontSize: "0.75rem", color: "#64748b" }}>
              Fecha hasta
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                style={{ width: "100%", padding: "0.4rem 0.5rem", fontSize: "0.85rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", boxSizing: "border-box", marginTop: "0.2rem" }}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <label style={{ flex: 1, fontSize: "0.75rem", color: "#64748b" }}>
              Importe mín. (en positivo)
              <input
                type="number"
                step="0.01"
                min={0}
                value={importeMin}
                onChange={(e) => setImporteMin(e.target.value)}
                style={{ width: "100%", padding: "0.4rem 0.5rem", fontSize: "0.85rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", boxSizing: "border-box", marginTop: "0.2rem" }}
              />
            </label>
            <label style={{ flex: 1, fontSize: "0.75rem", color: "#64748b" }}>
              Importe máx. (en positivo)
              <input
                type="number"
                step="0.01"
                min={0}
                value={importeMax}
                onChange={(e) => setImporteMax(e.target.value)}
                style={{ width: "100%", padding: "0.4rem 0.5rem", fontSize: "0.85rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", boxSizing: "border-box", marginTop: "0.2rem" }}
              />
            </label>
            <label style={{ flex: 1, fontSize: "0.75rem", color: "#64748b" }}>
              Debe/Haber
              <select
                value={tipoMovimiento}
                onChange={(e) => setTipoMovimiento(e.target.value as "" | "debe" | "haber")}
                style={{ width: "100%", padding: "0.4rem 0.5rem", fontSize: "0.85rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", boxSizing: "border-box", marginTop: "0.2rem" }}
              >
                <option value="">Todos</option>
                <option value="debe">Debe</option>
                <option value="haber">Haber</option>
              </select>
            </label>
          </div>
          <button
            onClick={() => buscar(1)}
            disabled={buscando}
            style={{
              padding: "0.5rem 0.9rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#fff",
              background: "#334155",
              border: "none",
              borderRadius: "0.375rem",
              cursor: buscando ? "default" : "pointer",
              opacity: buscando ? 0.6 : 1,
              alignSelf: "flex-start",
            }}
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </div>

        {buscado && (
          resultados.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Sin resultados para estos filtros.</p>
          ) : (
            <div>
              {!texto && !fechaDesde && !fechaHasta && !importeMin && !importeMax && (
                <p style={{ color: "#94a3b8", fontSize: "0.75rem", marginBottom: "0.4rem" }}>
                  Sin filtros se muestran solo los movimientos más recientes. Añade texto, fecha o importe para buscar en todo el histórico.
                </p>
              )}
            {totalResultados > RESULTADOS_POR_PAGINA && (
              <p style={{ color: "#94a3b8", fontSize: "0.75rem", marginBottom: "0.4rem" }}>
                Mostrando {(paginaResultados - 1) * RESULTADOS_POR_PAGINA + 1}-{Math.min(paginaResultados * RESULTADOS_POR_PAGINA, totalResultados)} de {totalResultados} resultados
              </p>
            )}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.5rem", overflow: "hidden" }}>
              {resultados.map((m) => (
                <div
                  key={m.id}
                  onClick={onClose}
                  style={{
                    padding: "0.6rem 0.8rem",
                    borderTop: "1px solid #f1f5f9",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.8rem", color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {m.concepto_original}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{m.fecha_operacion}</div>
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: Number(m.importe) < 0 ? "#dc2626" : "#15803d", whiteSpace: "nowrap" }}>
                    {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(m.importe))}
                  </div>
                </div>
              ))}
            </div>
            {totalResultados > RESULTADOS_POR_PAGINA && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.75rem", marginTop: "0.6rem" }}>
                <button
                  onClick={() => buscar(paginaResultados - 1)}
                  disabled={buscando || paginaResultados <= 1}
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", background: "#fff", cursor: paginaResultados <= 1 ? "default" : "pointer", opacity: paginaResultados <= 1 ? 0.5 : 1 }}
                >
                  Anterior
                </button>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Página {paginaResultados} de {Math.ceil(totalResultados / RESULTADOS_POR_PAGINA)}
                </span>
                <button
                  onClick={() => buscar(paginaResultados + 1)}
                  disabled={buscando || paginaResultados * RESULTADOS_POR_PAGINA >= totalResultados}
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", background: "#fff", cursor: paginaResultados * RESULTADOS_POR_PAGINA >= totalResultados ? "default" : "pointer", opacity: paginaResultados * RESULTADOS_POR_PAGINA >= totalResultados ? 0.5 : 1 }}
                >
                  Siguiente
                </button>
              </div>
            )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function DetalleProcesoOfiviajePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const ficheroId = decodeURIComponent(String(params.id));
  const fecha = searchParams.get("fecha");

  const [nombreFichero, setNombreFichero] = useState("");
  const [procesados, setProcesados] = useState<Procesado[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [paginaProcesados, setPaginaProcesados] = useState(1);
  const [paginaTareas, setPaginaTareas] = useState(1);
  const [busquedaProcesados, setBusquedaProcesados] = useState("");
  const [busquedaTareas, setBusquedaTareas] = useState("");
  const [cuentasProcesados, setCuentasProcesados] = useState<string[]>([]);
  const [cuentasTareas, setCuentasTareas] = useState<string[]>([]);
  const [tiposTareas, setTiposTareas] = useState<string[]>([]);
  const [creandoAliasId, setCreandoAliasId] = useState<string | null>(null);
  const [tareaBuscarMovimiento, setTareaBuscarMovimiento] = useState<Tarea | null>(null);

  const cargarDetalle = () => {
    return getDetalleProcesoOfiviaje(ficheroId).then((data) => {
      setNombreFichero(data.nombreFichero);
      setProcesados(data.procesados as Procesado[]);
      setTareas(data.tareas as Tarea[]);
    });
  };

  useEffect(() => {
    cargarDetalle().finally(() => setLoading(false));
  }, [ficheroId]);

  const handleCrearAlias = async (t: Tarea) => {
    if (!t.movConcepto) return;
    setCreandoAliasId(t.id);
    try {
      await guardarAliasProveedor(t.nombre, t.movConcepto);
      const res = await reprocesarFicheroOfiviaje(ficheroId);
      if (res.error) alert(res.error);
      await cargarDetalle();
    } finally {
      setCreandoAliasId(null);
    }
  };

  const cuentasDisponiblesProcesados = Array.from(
    new Map(
      procesados
        .filter((p) => p.cuentaBancariaId)
        .map((p) => [p.cuentaBancariaId as string, { id: p.cuentaBancariaId as string, nombre: p.cuentaBancariaNombre || "Sin nombre" }])
    ).values()
  );

  const cuentasDisponiblesTareas = Array.from(
    new Map(
      tareas
        .filter((t) => t.cuentaBancariaId)
        .map((t) => [t.cuentaBancariaId as string, { id: t.cuentaBancariaId as string, nombre: t.cuentaBancariaNombre || "Sin nombre" }])
    ).values()
  );

  const procesadosFiltrados = procesados.filter((p) => {
    const texto = busquedaProcesados.trim().toLowerCase();
    const coincideTexto =
      !texto ||
      p.movimientoConcepto.toLowerCase().includes(texto) ||
      p.proveedorNombre.toLowerCase().includes(texto) ||
      p.expediente.toLowerCase().includes(texto);
    const coincideCuenta = cuentasProcesados.length === 0 || (p.cuentaBancariaId && cuentasProcesados.includes(p.cuentaBancariaId));
    return coincideTexto && coincideCuenta;
  });

  const tiposDisponiblesTareas = Array.from(new Set(tareas.map((t) => t.tipo)));

  const tareasFiltradas = tareas.filter((t) => {
    const texto = busquedaTareas.trim().toLowerCase();
    const coincideTexto =
      !texto ||
      t.nombre.toLowerCase().includes(texto) ||
      t.expediente.toLowerCase().includes(texto) ||
      (t.movConcepto || "").toLowerCase().includes(texto) ||
      (ETIQUETA_TIPO[t.tipo] || t.tipo).toLowerCase().includes(texto);
    const coincideCuenta = cuentasTareas.length === 0 || (t.cuentaBancariaId && cuentasTareas.includes(t.cuentaBancariaId));
    const coincideTipo = tiposTareas.length === 0 || tiposTareas.includes(t.tipo);
    return coincideTexto && coincideCuenta && coincideTipo;
  });

  const tareasPendientesCount = tareasFiltradas.filter((t) => !t.resuelta).length;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, background: "#f8fafc" }}>
        <div style={{ width: "100%", padding: "1.5rem" }}>
          <NextLink
            href="/banco/historial-procesos"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "#334155", fontSize: "0.85rem", textDecoration: "none", marginBottom: "1rem" }}
          >
            <ArrowLeft size={16} />
            Volver al historial
          </NextLink>

          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" }}>
            {nombreFichero || "Detalle del proceso"}
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1.5rem" }}>
            {fecha ? parseFechaUtc(fecha).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : ""}
          </p>

          {loading ? (
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Cargando...</p>
          ) : (
            <>
              <div style={{ marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "0.8rem", fontWeight: 700, color: "#15803d", textTransform: "uppercase", marginBottom: "0.6rem" }}>
                  Procesados ({procesadosFiltrados.length})
                </h2>
                {procesados.length > 0 && (
                  <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.75rem" }}>
                    <div style={{ position: "relative", maxWidth: "320px", flex: 1 }}>
                      <Search size={14} style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                      <input
                        type="text"
                        placeholder="Buscar por concepto, proveedor o expediente..."
                        value={busquedaProcesados}
                        onChange={(e) => {
                          setBusquedaProcesados(e.target.value);
                          setPaginaProcesados(1);
                        }}
                        style={{
                          width: "100%",
                          padding: "0.45rem 0.6rem 0.45rem 2rem",
                          fontSize: "0.8rem",
                          border: "1px solid #e2e8f0",
                          borderRadius: "0.375rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <DropdownCuentas
                      cuentas={cuentasDisponiblesProcesados}
                      seleccionadas={cuentasProcesados}
                      onChange={(ids) => {
                        setCuentasProcesados(ids);
                        setPaginaProcesados(1);
                      }}
                    />
                  </div>
                )}
                {procesadosFiltrados.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                    {procesados.length === 0
                      ? "Sin movimientos conciliados registrados para este proceso."
                      : "Sin resultados para la búsqueda."}
                  </p>
                ) : (
                  <>
                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                        <thead>
                          <tr style={{ background: "#eef1f6", textAlign: "left" }}>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155", width: "70px" }}>Fecha</th>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>OFI / Movimiento bancario</th>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Expediente</th>
                            <th style={{ padding: "0.6rem 1.75rem 0.6rem 0.9rem", fontWeight: 600, color: "#334155", textAlign: "right" }}>Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {procesadosFiltrados.slice((paginaProcesados - 1) * POR_PAGINA, paginaProcesados * POR_PAGINA).map((p) => (
                            <tr key={p.movimientoId} style={{ borderTop: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "0.35rem 0.9rem", color: "#334155", whiteSpace: "nowrap", width: "70px" }}>
                                <div>{formatoFechaCorta(p.movimientoFecha)}</div>
                                {p.movimientoFechaValor && (
                                  <div style={{ color: "#94a3b8" }}>{formatoFechaCorta(p.movimientoFechaValor)}</div>
                                )}
                              </td>
                              <td style={{ padding: "0.35rem 0.9rem", maxWidth: "320px" }}>
                                <TooltipDatosXml
                                  datos={[
                                    { label: "Proveedor", valor: p.proveedorNombre },
                                    { label: "Documento", valor: p.documento },
                                    { label: "Expediente OFI", valor: p.expediente },
                                    { label: "Doc. cobro/pago", valor: p.documentoCobroPago },
                                    { label: "Pasajero", valor: p.nombrePasajero },
                                    { label: "Fecha vencto", valor: p.fechaVencto },
                                    { label: "Fecha doc", valor: p.fechaDoc },
                                  ]}
                                >
                                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    <span style={{ color: "#334155", fontWeight: 600 }}>{p.proveedorNombre}</span>
                                    {(p.documentoCobroPago || p.nombrePasajero) && (
                                      <span style={{ color: "#94a3b8" }}>
                                        {" "}
                                        · {p.documentoCobroPago}
                                        {p.documentoCobroPago && p.nombrePasajero ? " - " : ""}
                                        {p.nombrePasajero}
                                      </span>
                                    )}
                                  </div>
                                  <div title={p.movimientoConcepto} style={{ color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {p.movimientoConcepto}
                                  </div>
                                </TooltipDatosXml>
                              </td>
                              <td style={{ padding: "0.35rem 0.9rem", color: "#334155", whiteSpace: "nowrap" }}>{p.expediente}</td>
                              <td style={{ padding: "0.35rem 1.75rem 0.35rem 0.9rem", textAlign: "right" }}>
                                {p.ofiImporte != null && (
                                  <div style={{ color: "#94a3b8" }}>{formatoImporte(p.ofiImporte)}</div>
                                )}
                                <div style={{ color: "#15803d", fontWeight: 600 }}>{formatoImporte(p.movimientoImporte)}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {procesadosFiltrados.length > POR_PAGINA && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.6rem" }}>
                        <button
                          onClick={() => setPaginaProcesados((p) => Math.max(1, p - 1))}
                          disabled={paginaProcesados === 1}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "1.75rem",
                            height: "1.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.375rem",
                            background: "#fff",
                            color: "#334155",
                            cursor: paginaProcesados === 1 ? "default" : "pointer",
                            opacity: paginaProcesados === 1 ? 0.4 : 1,
                          }}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          Página {paginaProcesados} de {Math.ceil(procesadosFiltrados.length / POR_PAGINA)}
                        </span>
                        <button
                          onClick={() => setPaginaProcesados((p) => Math.min(Math.ceil(procesadosFiltrados.length / POR_PAGINA), p + 1))}
                          disabled={paginaProcesados >= Math.ceil(procesadosFiltrados.length / POR_PAGINA)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "1.75rem",
                            height: "1.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.375rem",
                            background: "#fff",
                            color: "#334155",
                            cursor: paginaProcesados >= Math.ceil(procesadosFiltrados.length / POR_PAGINA) ? "default" : "pointer",
                            opacity: paginaProcesados >= Math.ceil(procesadosFiltrados.length / POR_PAGINA) ? 0.4 : 1,
                          }}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <h2 style={{ fontSize: "0.8rem", fontWeight: 700, color: "#b45309", textTransform: "uppercase", marginBottom: "0.6rem" }}>
                  Incidencias ({tareasPendientesCount})
                </h2>
                {tareas.length > 0 && (
                  <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.75rem" }}>
                    <div style={{ position: "relative", maxWidth: "320px", flex: 1 }}>
                      <Search size={14} style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                      <input
                        type="text"
                        placeholder="Buscar por tipo, proveedor, expediente o concepto..."
                        value={busquedaTareas}
                        onChange={(e) => {
                          setBusquedaTareas(e.target.value);
                          setPaginaTareas(1);
                        }}
                        style={{
                          width: "100%",
                          padding: "0.45rem 0.6rem 0.45rem 2rem",
                          fontSize: "0.8rem",
                          border: "1px solid #e2e8f0",
                          borderRadius: "0.375rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <DropdownCuentas
                      cuentas={cuentasDisponiblesTareas}
                      seleccionadas={cuentasTareas}
                      onChange={(ids) => {
                        setCuentasTareas(ids);
                        setPaginaTareas(1);
                      }}
                    />
                    <DropdownTipos
                      tipos={tiposDisponiblesTareas}
                      seleccionados={tiposTareas}
                      onChange={(tipos) => {
                        setTiposTareas(tipos);
                        setPaginaTareas(1);
                      }}
                    />
                  </div>
                )}
                {tareasFiltradas.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                    {tareas.length === 0 ? "Sin incidencias para este proceso." : "Sin resultados para la búsqueda."}
                  </p>
                ) : (
                  <>
                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "0.5rem", background: "#fff" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                        <thead>
                          <tr style={{ background: "#eef1f6", textAlign: "left" }}>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155", width: "70px" }}>Fecha</th>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>OFI / Movimiento bancario</th>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Expediente</th>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155", textAlign: "right" }}>Importe</th>
                            <th style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Tipo</th>
                            <th style={{ padding: "0.6rem 1.75rem 0.6rem 0.9rem", fontWeight: 600, color: "#334155" }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tareasFiltradas.slice((paginaTareas - 1) * POR_PAGINA, paginaTareas * POR_PAGINA).map((t) => (
                            <tr key={t.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "0.35rem 0.9rem", color: "#334155", whiteSpace: "nowrap", width: "70px" }}>
                                <div>{formatoFechaXml(t.fechaVencto)}</div>
                                {t.movFecha ? (
                                  <div style={{ color: "#94a3b8" }}>{formatoFechaCorta(t.movFecha)}</div>
                                ) : (
                                  t.fechaDoc &&
                                  t.fechaDoc !== t.fechaVencto && (
                                    <div style={{ color: "#94a3b8" }}>{formatoFechaXml(t.fechaDoc)}</div>
                                  )
                                )}
                              </td>
                              <td style={{ padding: "0.35rem 0.9rem", maxWidth: "320px" }}>
                                <TooltipDatosXml
                                  datos={[
                                    { label: "Proveedor", valor: t.nombre },
                                    { label: "Documento", valor: t.documento },
                                    { label: "Expediente OFI", valor: t.expediente },
                                    { label: "Doc. cobro/pago", valor: t.documentoCobroPago },
                                    { label: "Pasajero", valor: t.nombrePasajero },
                                    { label: "Fecha vencto", valor: t.fechaVencto },
                                    { label: "Fecha doc", valor: t.fechaDoc },
                                  ]}
                                >
                                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    <span style={{ color: "#334155", fontWeight: 600 }}>{t.nombre}</span>
                                    {(t.documentoCobroPago || t.nombrePasajero) && (
                                      <span style={{ color: "#94a3b8" }}>
                                        {" "}
                                        · {t.documentoCobroPago}
                                        {t.documentoCobroPago && t.nombrePasajero ? " - " : ""}
                                        {t.nombrePasajero}
                                      </span>
                                    )}
                                  </div>
                                  <div title={t.movConcepto || undefined} style={{ color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {t.movConcepto || "—"}
                                  </div>
                                </TooltipDatosXml>
                              </td>
                              <td style={{ padding: "0.35rem 0.9rem", color: "#334155", whiteSpace: "nowrap" }}>{t.expediente}</td>
                              <td style={{ padding: "0.35rem 0.9rem", textAlign: "right" }}>
                                <div style={{ color: "#334155", fontWeight: 600 }}>{t.importe != null ? formatoImporte(t.importe) : "—"}</div>
                                {t.movImporte != null && (
                                  <div style={{ color: "#94a3b8" }}>{formatoImporte(t.movImporte)}</div>
                                )}
                              </td>
                              <td style={{ padding: "0.35rem 0.9rem" }}>
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                    padding: "0.15rem 0.5rem",
                                    borderRadius: "999px",
                                    color: t.resuelta ? "#15803d" : "#b45309",
                                    background: t.resuelta ? "#f0fdf4" : "#fef3c7",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {t.resuelta ? "Resuelta" : ETIQUETA_TIPO[t.tipo] || t.tipo}
                                </span>
                              </td>
                              <td style={{ padding: "0.35rem 1.75rem 0.35rem 0.9rem" }}>
                                {!t.resuelta && (
                                  <div style={{ display: "flex", gap: "0.3rem" }}>
                                    {t.tipo === "revisarNombre" && (
                                      <button
                                        onClick={() => handleCrearAlias(t)}
                                        disabled={creandoAliasId === t.id}
                                        style={{
                                          fontSize: "0.7rem",
                                          fontWeight: 600,
                                          padding: "0.2rem 0.5rem",
                                          borderRadius: "0.3rem",
                                          border: "1px solid #bbf7d0",
                                          background: "#f0fdf4",
                                          color: "#15803d",
                                          cursor: creandoAliasId === t.id ? "default" : "pointer",
                                          opacity: creandoAliasId === t.id ? 0.6 : 1,
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {creandoAliasId === t.id ? "Creando..." : "Crear alias"}
                                      </button>
                                    )}
                                    {t.tipo === "revisarImporte" && (
                                      <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#b45309", whiteSpace: "nowrap", alignSelf: "center" }}>
                                        CORREGIR IMPORTE EN OFIViaje
                                      </span>
                                    )}
                                    {t.tipo === "sinMatch" && (
                                      <button
                                        onClick={() => setTareaBuscarMovimiento(t)}
                                        style={{
                                          fontSize: "0.7rem",
                                          fontWeight: 600,
                                          padding: "0.2rem 0.5rem",
                                          borderRadius: "0.3rem",
                                          border: "1px solid #e2e8f0",
                                          background: "#fff",
                                          color: "#334155",
                                          cursor: "pointer",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        Buscar movimiento
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {tareasFiltradas.length > POR_PAGINA && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.6rem" }}>
                        <button
                          onClick={() => setPaginaTareas((p) => Math.max(1, p - 1))}
                          disabled={paginaTareas === 1}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "1.75rem",
                            height: "1.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.375rem",
                            background: "#fff",
                            color: "#334155",
                            cursor: paginaTareas === 1 ? "default" : "pointer",
                            opacity: paginaTareas === 1 ? 0.4 : 1,
                          }}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          Página {paginaTareas} de {Math.ceil(tareasFiltradas.length / POR_PAGINA)}
                        </span>
                        <button
                          onClick={() => setPaginaTareas((p) => Math.min(Math.ceil(tareasFiltradas.length / POR_PAGINA), p + 1))}
                          disabled={paginaTareas >= Math.ceil(tareasFiltradas.length / POR_PAGINA)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "1.75rem",
                            height: "1.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.375rem",
                            background: "#fff",
                            color: "#334155",
                            cursor: paginaTareas >= Math.ceil(tareasFiltradas.length / POR_PAGINA) ? "default" : "pointer",
                            opacity: paginaTareas >= Math.ceil(tareasFiltradas.length / POR_PAGINA) ? 0.4 : 1,
                          }}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {tareaBuscarMovimiento && (
        <ModalBuscarMovimiento tarea={tareaBuscarMovimiento} onClose={() => setTareaBuscarMovimiento(null)} />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Landmark, ChevronDown, Menu, Link2, HardDrive, FileCheck2 } from "lucide-react";
import { getMovimientosBanco, connectBridgeBank, syncBridgeBankMovements, previsualizarConciliacionOfiviaje, confirmarConciliacionOfiviaje } from "@/actions/banco";
import { getCuentasBancarias } from "@/actions/cuentasBancarias";
import { getCurrentAgencyDetails } from "@/actions/agencias";
import DriveAuthModal from "@/app/components/DriveAuthModal";

// Colores espaciados en el círculo cromático para que sean fácilmente distinguibles
// entre sí, incluso con varias cuentas visibles a la vez.
const CUENTA_COLOR_PALETTE = [
  { color: "#ef4444", bg: "#fef2f2" }, // rojo
  { color: "#3b82f6", bg: "#eff6ff" }, // azul
  { color: "#65a30d", bg: "#f7fee7" }, // verde
  { color: "#f59e0b", bg: "#fffbeb" }, // ámbar
  { color: "#8b5cf6", bg: "#f5f3ff" }, // violeta
  { color: "#0891b2", bg: "#ecfeff" }, // cian
  { color: "#db2777", bg: "#fdf2f8" }, // rosa
  { color: "#78716c", bg: "#f5f5f4" }, // gris cálido
];

// Color estable por cuenta bancaria (no por nombre de banco), asignado por su
// posición dentro de la lista completa de cuentas de la agencia (ordenada por id),
// para garantizar que no se repitan colores mientras haya ≤ 8 cuentas.
const getCuentaColor = (cuentaId: string | undefined, cuentasOrdenadas: string[]) => {
  if (!cuentaId) return { color: "#64748b", bg: "#f8fafc" };
  const idx = cuentasOrdenadas.indexOf(cuentaId);
  if (idx === -1) return { color: "#64748b", bg: "#f8fafc" };
  return CUENTA_COLOR_PALETTE[idx % CUENTA_COLOR_PALETTE.length];
};

const getEstadoLabel = (estado: string) => {
  switch (estado) {
    case "conciliado":
      return { label: "Conciliado", color: "#15803d", bg: "#dcfce7" };
    case "propuesto":
      return { label: "Matching", color: "#6d28d9", bg: "#ede9fe" };
    case "parcial":
      return { label: "Parcial", color: "#b45309", bg: "#fef3c7" };
    case "pendiente":
    default:
      return { label: "Pendiente", color: "#b45309", bg: "#fef3c7" };
  }
};

const inputStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  padding: "0.4rem 0.5rem",
  border: "1px solid #e2e8f0",
  borderRadius: "0.375rem",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "#334155",
  marginBottom: "0.3rem",
  display: "block",
};

export default function MovimientosAppPage() {
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [agencyDetails, setAgencyDetails] = useState<{ logo_url: string | null; nombre_comercial: string; color_corporativo?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showBancoDropdown, setShowBancoDropdown] = useState(false);
  const bancoDropdownRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [connectingBank, setConnectingBank] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [checkingOfiviaje, setCheckingOfiviaje] = useState(false);
  const [ofiviajePreview, setOfiviajePreview] = useState<any | null>(null);
  const [confirmingOfiviaje, setConfirmingOfiviaje] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const FECHA_DESDE_DEFECTO = "2026-07-01";

  const [filtros, setFiltros] = useState({
    bancosIds: [] as string[],
    tipoMovimiento: "todos" as "todos" | "debe" | "haber",
    fechaDesde: FECHA_DESDE_DEFECTO,
    fechaHasta: "",
    importeMin: "",
    importeMax: "",
    estados: [] as string[],
  });

  const [soloOfiviaje, setSoloOfiviaje] = useState(false);

  const updateFiltro = <K extends keyof typeof filtros>(key: K, value: (typeof filtros)[K]) => {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  };

  const toggleEstadoFilter = (estado: string) => {
    setFiltros((prev) => ({
      ...prev,
      estados: prev.estados.includes(estado)
        ? prev.estados.filter((e) => e !== estado)
        : [...prev.estados, estado],
    }));
  };

  const toggleBancoFilter = (id: string) => {
    setFiltros((prev) => ({
      ...prev,
      bancosIds: prev.bancosIds.includes(id)
        ? prev.bancosIds.filter((b) => b !== id)
        : [...prev.bancosIds, id],
    }));
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bancoDropdownRef.current && !bancoDropdownRef.current.contains(e.target as Node)) {
        setShowBancoDropdown(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadAccounts() {
      try {
        const accountsData = await getCuentasBancarias();
        setCuentasBancarias(accountsData || []);
      } catch (error) {
        console.error("Error loading bank accounts:", error);
      }
    }
    loadAccounts();
  }, []);

  useEffect(() => {
    async function loadAgency() {
      try {
        const details = await getCurrentAgencyDetails();
        setAgencyDetails(details);
      } catch (error) {
        console.error("Error loading agency details:", error);
      }
    }
    loadAgency();
  }, []);

  const loadData = useCallback(async (filters: typeof filtros, search: string) => {
    try {
      setLoading(true);
      const result = await getMovimientosBanco({
        page: 1,
        limit: 500,
        search,
        tipoMovimiento: filters.tipoMovimiento === "todos" ? undefined : filters.tipoMovimiento,
        fechaDesde: filters.fechaDesde || undefined,
        fechaHasta: filters.fechaHasta || undefined,
        importeMin: filters.importeMin ? Number(filters.importeMin) : undefined,
        importeMax: filters.importeMax ? Number(filters.importeMax) : undefined,
        estados: filters.estados.length > 0 ? filters.estados : undefined,
        cuentaIds: filters.bancosIds.length > 0 ? filters.bancosIds : undefined,
      });
      setMovimientos(result.data || []);
    } catch (error) {
      console.error("Error loading bank movements:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(filtros, searchQuery);
  }, [loadData, filtros, searchQuery]);

  const handleConnectBank = async () => {
    setShowMenu(false);
    setConnectingBank(true);
    try {
      const res = await connectBridgeBank();
      if (res.error || !res.connectUrl) {
        alert(res.error || "No se pudo iniciar la conexión con el banco.");
        return;
      }

      const popup = window.open(res.connectUrl, "_blank", "width=500,height=700");

      const checkClosed = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          const syncRes = await syncBridgeBankMovements();
          if (syncRes.error) {
            console.error("Error sincronizando con Bridge:", syncRes.error);
          } else {
            loadData(filtros, searchQuery);
          }
          setConnectingBank(false);
        }
      }, 1000);
    } catch (error) {
      console.error("Error conectando banco:", error);
      setConnectingBank(false);
    }
  };

  const handleCheckOfiviaje = async () => {
    setShowMenu(false);
    setCheckingOfiviaje(true);
    try {
      const res = await previsualizarConciliacionOfiviaje();
      const hayAlgoQueMostrar =
        res.matches.length > 0 || (res.revisarNombre?.length || 0) > 0 || (res.sinMatch?.length || 0) > 0;

      if (res.error) {
        alert(res.error);
      } else if (res.ficherosNuevos === 0) {
        alert("No hay ficheros nuevos de OFIviaje en la carpeta de Drive.");
      } else if (!hayAlgoQueMostrar && res.yaConciliados > 0) {
        alert(`Comprobados ${res.procesados} pagos en ${res.ficherosNuevos} fichero(s) nuevo(s). Los ${res.yaConciliados} ya estaban conciliados previamente.`);
      } else if (!hayAlgoQueMostrar) {
        alert(`Comprobados ${res.procesados} pagos en ${res.ficherosNuevos} fichero(s) nuevo(s). No se encontró ningún movimiento para conciliar.`);
      } else {
        setOfiviajePreview(res);
      }
    } catch (error) {
      console.error("Error comprobando OFIviaje:", error);
      alert("Error al comprobar la conciliación con OFIviaje.");
    } finally {
      setCheckingOfiviaje(false);
    }
  };

  const handleConfirmOfiviaje = async () => {
    if (!ofiviajePreview) return;
    setConfirmingOfiviaje(true);
    try {
      const res = await confirmarConciliacionOfiviaje(ofiviajePreview.matches);
      if (res.error) {
        alert(res.error);
      } else {
        alert(`${res.conciliados} movimiento(s) conciliado(s) con OFIviaje.`);
        loadData(filtros, searchQuery);
      }
    } catch (error) {
      console.error("Error confirmando conciliación OFIviaje:", error);
      alert("Error al confirmar la conciliación con OFIviaje.");
    } finally {
      setConfirmingOfiviaje(false);
      setOfiviajePreview(null);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed.length >= 3 || trimmed === "") {
        setSearchQuery(trimmed);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const formatDateHeader = (dateStr: string | null) => {
    if (!dateStr) return "Sin fecha";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const formatImporte = (val: number) => {
    const formatted = new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(Math.abs(val));
    return val >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  const movimientosVisibles = soloOfiviaje ? movimientos.filter((m) => m.conciliado_externo) : movimientos;

  const grupos = movimientosVisibles.reduce((acc: Record<string, any[]>, mov) => {
    const key = mov.fecha_operacion || "sin-fecha";
    if (!acc[key]) acc[key] = [];
    acc[key].push(mov);
    return acc;
  }, {});

  const fechasOrdenadas = Object.keys(grupos).sort((a, b) => (a < b ? 1 : -1));

  const cuentasIdsOrdenadas = [...cuentasBancarias].map((c: any) => c.id).sort();

  const filtrosActivos =
    filtros.bancosIds.length > 0 ||
    filtros.tipoMovimiento !== "todos" ||
    filtros.fechaDesde !== FECHA_DESDE_DEFECTO ||
    filtros.fechaHasta ||
    filtros.importeMin ||
    filtros.importeMax ||
    filtros.estados.length > 0;

  const ESTADO_OPTIONS = [
    { value: "pendiente", label: "Pendiente" },
    { value: "propuesto", label: "Matching" },
    { value: "parcial", label: "Parcial" },
    { value: "conciliado", label: "Conciliado" },
  ];

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
      }}
    >
      {/* TOPBAR PROPIA DE ESTA PÁGINA */}
      <header
        style={{
          flexShrink: 0,
          height: "44px",
          background: "var(--primary-color, #475569)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1.5rem",
          boxSizing: "border-box",
        }}
      >
        {agencyDetails?.logo_url ? (
          <img
            src={agencyDetails.logo_url}
            alt={agencyDetails.nombre_comercial}
            style={{ height: "24px", maxWidth: "150px", objectFit: "contain", borderRadius: "4px" }}
          />
        ) : (
          <span style={{ color: "#fff", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "-0.015em" }}>
            {agencyDetails?.nombre_comercial || "Momo"}
          </span>
        )}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            title="Menú"
            onClick={() => setShowMenu((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: "0.4rem",
            }}
          >
            <Menu size={22} />
          </button>

          {showMenu && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                minWidth: "180px",
                background: "#ffffff",
                borderRadius: "0.5rem",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
                border: "1px solid #e2e8f0",
                padding: "0.35rem",
                zIndex: 1010,
              }}
            >
              <button
                onClick={handleConnectBank}
                disabled={connectingBank}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: "#334155",
                  background: "none",
                  border: "none",
                  borderRadius: "0.375rem",
                  textAlign: "left",
                  cursor: connectingBank ? "default" : "pointer",
                  opacity: connectingBank ? 0.6 : 1,
                }}
              >
                <Link2 size={16} />
                <span>{connectingBank ? "Conectando..." : "Conectar Banco"}</span>
              </button>

              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowDriveModal(true);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: "#334155",
                  background: "none",
                  border: "none",
                  borderRadius: "0.375rem",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <HardDrive size={16} />
                <span>Conectar Drive</span>
              </button>

              <button
                onClick={handleCheckOfiviaje}
                disabled={checkingOfiviaje}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: "#334155",
                  background: "none",
                  border: "none",
                  borderRadius: "0.375rem",
                  textAlign: "left",
                  cursor: checkingOfiviaje ? "default" : "pointer",
                  opacity: checkingOfiviaje ? 0.6 : 1,
                }}
              >
                <FileCheck2 size={16} />
                <span>{checkingOfiviaje ? "Comprobando..." : "Comprobar OFIviaje"}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div
        className="movimientosAppContainer"
        style={{
          fontSize: "0.85rem",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          maxWidth: "900px",
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
          overflowX: "hidden",
        }}
      >
      <style jsx>{`
        @media (max-width: 480px) {
          .movimientosAppContainer {
            font-size: 0.75rem !important;
          }
          .movimientosAppHeader,
          .movimientosAppScroll {
            padding-left: 1rem !important;
            padding-right: 1rem !important;
          }
        }
        .ofiviajeTagWrapper:hover .ofiviajeTooltip {
          opacity: 1 !important;
          visibility: visible !important;
        }
      `}</style>

      {/* BUSCADOR + FILTRO + ETIQUETAS DE ESTADO (fijos, no hacen scroll) */}
      <div
        className="movimientosAppHeader"
        style={{
          flexShrink: 0,
          background: "#ffffff",
          padding: "1.5rem 1.5rem 0.75rem",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="text"
              placeholder="Buscar (mín. 3 letras)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ ...inputStyle, height: "34px", padding: "0 0.75rem" }}
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            title="Filtrar"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "34px",
              height: "34px",
              flexShrink: 0,
              border: `1px solid ${filtrosActivos || showFilters ? "#475569" : "#e2e8f0"}`,
              background: filtrosActivos ? "#f1f5f9" : "#fff",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </button>
        </div>

        {/* Etiquetas de filtro por estado */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {ESTADO_OPTIONS.map((opt) => {
            const active = filtros.estados.includes(opt.value);
            const estadoStyle = getEstadoLabel(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleEstadoFilter(opt.value)}
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "999px",
                  cursor: "pointer",
                  color: active ? estadoStyle.color : "#94a3b8",
                  background: active ? estadoStyle.bg : "#f8fafc",
                  border: `1px solid ${active ? estadoStyle.color : "#e2e8f0"}`,
                }}
              >
                {opt.label}
              </button>
            );
          })}
          <button
            onClick={() => setSoloOfiviaje((v) => !v)}
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              cursor: "pointer",
              color: soloOfiviaje ? "#0e7490" : "#94a3b8",
              background: soloOfiviaje ? "#cffafe" : "#f8fafc",
              border: `1px solid ${soloOfiviaje ? "#0e7490" : "#e2e8f0"}`,
            }}
          >
            OFIviaje
          </button>
        </div>

      {/* PANEL DE FILTROS */}
      {showFilters && (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            padding: "1rem",
            marginTop: "0.6rem",
            background: "#fafbfc",
            display: "flex",
            flexDirection: "column",
            gap: "0.9rem",
          }}
        >
          {/* Banco */}
          <div ref={bancoDropdownRef} style={{ position: "relative" }}>
            <span style={labelStyle}>Banco</span>
            <button
              onClick={() => setShowBancoDropdown((v) => !v)}
              style={{
                ...inputStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#fff",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {filtros.bancosIds.length === 0
                  ? "Todos los bancos"
                  : `${filtros.bancosIds.length} banco${filtros.bancosIds.length > 1 ? "s" : ""} seleccionado${filtros.bancosIds.length > 1 ? "s" : ""}`}
              </span>
              <ChevronDown size={14} style={{ flexShrink: 0, transform: showBancoDropdown ? "rotate(180deg)" : "none" }} />
            </button>

            {showBancoDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: "0.25rem",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.375rem",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  maxHeight: "180px",
                  overflowY: "auto",
                  zIndex: 20,
                }}
              >
                {cuentasBancarias.filter((c: any) => c.iban).length === 0 ? (
                  <div style={{ padding: "0.5rem", fontSize: "0.75rem", color: "#94a3b8" }}>Sin cuentas</div>
                ) : (
                  cuentasBancarias
                    .filter((c: any) => c.iban)
                    .map((c: any) => (
                      <label
                        key={c.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          padding: "0.4rem 0.6rem",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={filtros.bancosIds.includes(c.id)}
                          onChange={() => toggleBancoFilter(c.id)}
                        />
                        {c.banco}
                      </label>
                    ))
                )}
              </div>
            )}
          </div>

          {/* Debe/Haber */}
          <div>
            <span style={labelStyle}>Debe / Haber</span>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              {["todos", "debe", "haber"].map((t) => (
                <button
                  key={t}
                  onClick={() => updateFiltro("tipoMovimiento", t as any)}
                  style={{
                    flex: 1,
                    padding: "0.35rem 0",
                    fontWeight: 600,
                    border: `1px solid ${filtros.tipoMovimiento === t ? "#475569" : "#e2e8f0"}`,
                    background: filtros.tipoMovimiento === t ? "#f1f5f9" : "#fff",
                    color: filtros.tipoMovimiento === t ? "#334155" : "#64748b",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                  }}
                >
                  {t === "todos" ? "Todos" : t === "debe" ? "Debe" : "Haber"}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha */}
          <div>
            <span style={labelStyle}>Fecha</span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="date"
                value={filtros.fechaDesde}
                onChange={(e) => updateFiltro("fechaDesde", e.target.value)}
                style={inputStyle}
              />
              <input
                type="date"
                value={filtros.fechaHasta}
                onChange={(e) => updateFiltro("fechaHasta", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Importe */}
          <div>
            <span style={labelStyle}>Importe (€)</span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="number"
                placeholder="Desde"
                value={filtros.importeMin}
                onChange={(e) => updateFiltro("importeMin", e.target.value)}
                style={inputStyle}
              />
              <input
                type="number"
                placeholder="Hasta"
                value={filtros.importeMax}
                onChange={(e) => updateFiltro("importeMax", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {filtrosActivos && (
            <button
              onClick={() =>
                setFiltros({
                  bancosIds: [],
                  tipoMovimiento: "todos",
                  fechaDesde: FECHA_DESDE_DEFECTO,
                  fechaHasta: "",
                  importeMin: "",
                  importeMax: "",
                  estados: [],
                })
              }
              style={{
                padding: "0.4rem",
                background: "#f1f5f9",
                color: "#475569",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
      </div>

      {/* LISTADO (única zona con scroll) */}
      <div
        className="movimientosAppScroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0.75rem 1.5rem 1.5rem",
          boxSizing: "border-box",
        }}
      >
      {loading ? (
        <p style={{ textAlign: "center", color: "#64748b" }}>Cargando movimientos...</p>
      ) : movimientosVisibles.length === 0 ? (
        <p style={{ textAlign: "center", color: "#64748b" }}>
          {soloOfiviaje ? "No hay movimientos conciliados con OFIviaje." : "No se encontraron movimientos."}
        </p>
      ) : (
        fechasOrdenadas.map((fecha) => (
          <div key={fecha} style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.4rem 0" }}>
              <span style={{ fontSize: "1.4rem", fontWeight: 300, color: "#cbd5e1", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                {formatDateHeader(fecha)}
              </span>
              <span style={{ flex: 1, height: "1px", background: "#cbd5e1" }} />
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {grupos[fecha].map((mov) => {
                const estado = getEstadoLabel(mov.estado);
                const bankName = mov.config_cuentas_bancarias?.banco || "Banco";
                const bankColor = getCuentaColor(mov.cuenta_bancaria_id, cuentasIdsOrdenadas);
                return (
                  <li
                    key={mov.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.5rem",
                      padding: "0.6rem 0",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <div
                      title={bankName}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "24px",
                        height: "24px",
                        flexShrink: 0,
                        marginTop: "0.1rem",
                        borderRadius: "50%",
                        color: bankColor.color,
                        background: bankColor.bg,
                      }}
                    >
                      <Landmark size={13} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#0f172a",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={mov.concepto_original || "Movimiento sin concepto"}
                    >
                      {mov.concepto_original || "Movimiento sin concepto"}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "0.15rem",
                      }}
                    >
                      <span style={{ display: "flex", gap: "0.3rem" }}>
                        {(!mov.conciliado_externo || mov.estado === "parcial") && (
                          <span
                            style={{
                              fontSize: "0.6rem",
                              fontWeight: 400,
                              textTransform: "uppercase",
                              color: estado.color,
                              background: estado.bg,
                              borderRadius: "0.25rem",
                              padding: "0.1rem 0.35rem",
                            }}
                          >
                            {estado.label}
                          </span>
                        )}
                        {mov.conciliado_externo && (
                          <span className="ofiviajeTagWrapper" style={{ position: "relative", display: "inline-block" }}>
                            <span
                              style={{
                                fontSize: "0.6rem",
                                fontWeight: 400,
                                textTransform: "uppercase",
                                color: "#0e7490",
                                background: "#cffafe",
                                borderRadius: "0.25rem",
                                padding: "0.1rem 0.35rem",
                                cursor: "default",
                              }}
                            >
                              OFIviaje
                            </span>
                            {mov.conciliado_externo_datos && (
                              <div
                                className="ofiviajeTooltip"
                                style={{
                                  position: "absolute",
                                  bottom: "calc(100% + 6px)",
                                  left: 0,
                                  zIndex: 20,
                                  minWidth: "220px",
                                  background: "#0f172a",
                                  color: "#e2e8f0",
                                  borderRadius: "0.5rem",
                                  padding: "0.6rem 0.75rem",
                                  fontSize: "0.72rem",
                                  fontWeight: 400,
                                  textTransform: "none",
                                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
                                  opacity: 0,
                                  visibility: "hidden",
                                  transition: "opacity 0.15s",
                                  pointerEvents: "none",
                                }}
                              >
                                <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>
                                  {mov.conciliado_externo_datos.proveedorNombre}
                                </div>
                                <div>Doc: {mov.conciliado_externo_datos.documento}</div>
                                <div>Expediente OFI: {mov.conciliado_externo_datos.referenciaProvCte}</div>
                                <div>Doc. cobro/pago: {mov.conciliado_externo_datos.documentoCobroPago}</div>
                                <div>
                                  Importe:{" "}
                                  {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
                                    mov.conciliado_externo_datos.importePendiente
                                  )}
                                </div>
                                <div>Fecha vencto: {mov.conciliado_externo_datos.fechaVencto}</div>
                                <div>Pasajero: {mov.conciliado_externo_datos.nombrePasajero}</div>
                              </div>
                            )}
                          </span>
                        )}
                      </span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: mov.importe >= 0 ? "#10b981" : "#ef4444",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {formatImporte(mov.importe)}
                      </span>
                    </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
      </div>
      </div>

      <DriveAuthModal isOpen={showDriveModal} onClose={() => setShowDriveModal(false)} />

      {/* INFORME DE CONCILIACIÓN OFIVIAJE (previo a aplicar cambios) */}
      {ofiviajePreview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
            padding: "1rem",
          }}
          onClick={() => !confirmingOfiviaje && setOfiviajePreview(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "0.75rem",
              width: "100%",
              maxWidth: "560px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
                Conciliación con OFIviaje
              </h2>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                {ofiviajePreview.ficherosNuevos} fichero(s) nuevo(s), {ofiviajePreview.procesados} pago(s) leído(s).
                Se proponen <strong>{ofiviajePreview.matches.length}</strong> movimiento(s) a conciliar
                {ofiviajePreview.revisarNombre?.length > 0 && (
                  <> · <strong>{ofiviajePreview.revisarNombre.length}</strong> a revisar en OFI</>
                )}
                {ofiviajePreview.sinMatch?.length > 0 && (
                  <> · <strong>{ofiviajePreview.sinMatch.length}</strong> sin movimiento bancario encontrado</>
                )}
                {!!ofiviajePreview.yaConciliados && (
                  <> · <strong>{ofiviajePreview.yaConciliados}</strong> ya conciliado(s) previamente</>
                )}
                .
              </p>
            </div>

            <div style={{ padding: "0.75rem 1.5rem", overflowY: "auto", flex: 1 }}>
              {ofiviajePreview.matches.length > 0 && (
                <>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#15803d", textTransform: "uppercase", marginBottom: "0.4rem" }}>
                    Se van a conciliar
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, marginBottom: "1.25rem" }}>
                    {ofiviajePreview.matches.map((m: any, i: number) => (
                      <li
                        key={i}
                        style={{
                          padding: "0.6rem 0",
                          borderBottom: "1px solid #f1f5f9",
                          fontSize: "0.8rem",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>
                          {m.movimientoConcepto || "Movimiento sin concepto"}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", marginTop: "0.15rem" }}>
                          <span>{m.movimientoFecha} · {m.pago.proveedorNombre}</span>
                          <span style={{ fontWeight: 700, color: m.movimientoImporte >= 0 ? "#10b981" : "#ef4444" }}>
                            {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Math.abs(m.movimientoImporte))}
                          </span>
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: "0.72rem", marginTop: "0.15rem" }}>
                          Doc: {m.pago.documento} · Expediente OFI: {m.pago.referenciaProvCte} · Doc. cobro/pago: {m.pago.documentoCobroPago} · Pasajero: {m.pago.nombrePasajero}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {ofiviajePreview.revisarNombre?.length > 0 && (
                <>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", marginBottom: "0.4rem" }}>
                    Mismo importe, proveedor distinto — revisar en OFI
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, marginBottom: "1.25rem" }}>
                    {ofiviajePreview.revisarNombre.map((m: any, i: number) => (
                      <li
                        key={i}
                        style={{
                          padding: "0.6rem 0",
                          borderBottom: "1px solid #f1f5f9",
                          fontSize: "0.8rem",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>
                          Banco: {m.movimientoConcepto || "Movimiento sin concepto"}
                        </div>
                        <div style={{ color: "#64748b", marginTop: "0.1rem" }}>
                          OFI: {m.pago.proveedorNombre}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", marginTop: "0.15rem" }}>
                          <span>{m.movimientoFecha}</span>
                          <span style={{ fontWeight: 700, color: "#dc2626" }}>
                            {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Math.abs(m.movimientoImporte))}
                          </span>
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: "0.72rem", marginTop: "0.15rem" }}>
                          Doc: {m.pago.documento} · Revisa/corrige el proveedor en OFI para que el próximo XML lo detecte correctamente
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {ofiviajePreview.sinMatch?.length > 0 && (
                <>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#b45309", textTransform: "uppercase", marginBottom: "0.4rem" }}>
                    Sin movimiento bancario encontrado
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {ofiviajePreview.sinMatch.map((p: any, i: number) => (
                      <li
                        key={i}
                        style={{
                          padding: "0.6rem 0",
                          borderBottom: "1px solid #f1f5f9",
                          fontSize: "0.8rem",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{p.proveedorNombre}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", marginTop: "0.15rem" }}>
                          <span>{p.fechaVencto} · {p.nombrePasajero}</span>
                          <span style={{ fontWeight: 700, color: "#b45309" }}>
                            {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(p.importePendiente)}
                          </span>
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: "0.72rem", marginTop: "0.15rem" }}>
                          Doc: {p.documento} · Doc. cobro/pago: {p.documentoCobroPago}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => setOfiviajePreview(null)}
                disabled={confirmingOfiviaje}
                style={{
                  flex: 1,
                  padding: "0.6rem",
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.5rem",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: confirmingOfiviaje ? "default" : "pointer",
                }}
              >
                {ofiviajePreview.matches.length > 0 ? "Cancelar" : "Cerrar"}
              </button>
              {ofiviajePreview.matches.length > 0 && (
                <button
                  onClick={handleConfirmOfiviaje}
                  disabled={confirmingOfiviaje}
                  style={{
                    flex: 1,
                    padding: "0.6rem",
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: confirmingOfiviaje ? "default" : "pointer",
                    opacity: confirmingOfiviaje ? 0.7 : 1,
                  }}
                >
                  {confirmingOfiviaje ? "Aplicando..." : "Aceptar y conciliar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

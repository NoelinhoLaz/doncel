"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import { Trash2, Plus, Download, Package, Users, Moon, Landmark, Info, Mail } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { FolderPlus } from "lucide-react";
import { Icons } from "@/lib/icons";
import AccionesLineaCell from "@/app/components/ui/AccionesLineaCell";
import TipoSelectorPopup from "@/app/components/ui/TipoSelectorPopup";
import ProviderSelector from "@/app/expedientes/[id]/components/ProviderSelector";
import DestinationSelector from "@/app/expedientes/[id]/components/DestinationSelector";
import styles from "@/app/expedientes/shared.module.css";
import listStyles from "@/app/expedientes/page.module.css";
import tablaStyles from "@/app/components/cotizacion/tabla.module.css";

interface Props {
  serviciosList: any[];
  expedienteId: string;
  loading?: boolean;
  onDeleteServicio: (id: string) => void;
  onOpenInfo?: (item: any) => void;
  onOpenEmail?: (item: any) => void;
  onUpdateImporte: (id: string, neto: number | undefined, pvp: number | undefined) => Promise<void>;
  onUpdateNoches: (id: string, noches: number | null) => Promise<void>;
  onUpdateDestino: (id: string, destino: string | null) => Promise<void>;
  onUpdateDescripcion: (id: string, descripcion: string) => Promise<void>;
  onUpdateProveedor: (id: string, proveedor: string) => Promise<void>;
  onUpdatePlazas: (id: string, plazas: number) => Promise<void>;
  onUpdateTipo?: (id: string, tipo: string) => Promise<void>;
  onVincularCotizacion?: (id: string) => Promise<void>;
  saveStatus?: Record<string, "saving" | "saved" | "error">;
  onAbrirManual: () => void;
  onAbrirImportar: () => void;
  getTypeInfo: (typeId: string) => any;
  serviceTypes?: any[];
  pendingMatchCount?: number;
  onOpenMatchModal?: () => void;
  onRegistrarPago?: () => void;
  onEnviarValoracion?: () => void;
}

const fieldStyle: React.CSSProperties = {
  background: "#ffffff", border: "1px solid #e2e8f0", padding: "0.1rem 0.3rem",
  borderRadius: 6, height: 25, color: "inherit", boxSizing: "border-box", fontSize: "0.7rem",
};

function TipoSelectorServicio({
  ser,
  getTypeInfo,
  serviceTypes,
  onUpdateTipo,
  isOpen,
  onToggle,
}: {
  ser: any;
  getTypeInfo: (id: string) => any;
  serviceTypes: any[];
  onUpdateTipo?: (id: string, tipo: string) => Promise<void>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const info = getTypeInfo(ser.tipo);

  if (!onUpdateTipo) {
    const IconComponent = (LucideIcons as any)[info.icono] || FolderPlus;
    return (
      <div
        title={info.label}
        style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", borderRadius: 6 }}
      >
        <IconComponent size={14} />
      </div>
    );
  }

  return (
    <TipoSelectorPopup
      tipos={serviceTypes}
      selectedId={ser.tipo}
      selectedIcono={info.icono}
      selectedLabel={info.label}
      isOpen={isOpen}
      onToggle={onToggle}
      onSelect={(tipoId) => onUpdateTipo(ser.id, tipoId)}
    />
  );
}

function EstadoPagoBadge({ abonado, pvp }: { abonado: number; pvp: number }) {
  const { label, color, bg } = pvp > 0 && abonado >= pvp
    ? { label: "Pagado", color: "#16a34a", bg: "#f0fdf4" }
    : abonado > 0
      ? { label: "Parcial", color: "#d97706", bg: "#fffbeb" }
      : { label: "Pendiente", color: "#94a3b8", bg: "#f8fafc" };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", backgroundColor: bg, color, fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

export default function TablaServiciosNoOpcionales({
  serviciosList,
  expedienteId,
  loading = false,
  onDeleteServicio,
  onOpenInfo,
  onOpenEmail,
  onUpdateImporte,
  onUpdateNoches,
  onUpdateDestino,
  onUpdateDescripcion,
  onUpdateProveedor,
  onUpdatePlazas,
  onUpdateTipo,
  onVincularCotizacion,
  saveStatus = {},
  onAbrirManual,
  onAbrirImportar,
  getTypeInfo,
  serviceTypes = [],
  pendingMatchCount = 0,
  onOpenMatchModal,
  onRegistrarPago,
  onEnviarValoracion,
}: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch] = useState("");
  const [openTipoRowId, setOpenTipoRowId] = useState<string | null>(null);

  useEffect(() => {
    if (!openTipoRowId) return;
    const close = () => setOpenTipoRowId(null);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [openTipoRowId]);

  const filteredList = useMemo(
    () => serviciosList
      .filter((item) =>
        (item.descripcion || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.proveedor || "").toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => Number(!!a.opcional) - Number(!!b.opcional)),
    [serviciosList, search]
  );

  const firstOpcionalIndex = filteredList.findIndex((item) => !!item.opcional);
  const [unlinkedProviderIds, setUnlinkedProviderIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  return (
    <div className={styles.tabContainer} style={{ marginTop: "2rem" }}>
      {/* Header */}
      <div className={styles.listHeaderTop} style={{ borderBottom: "1px solid #e2e8f0" }}>
        <div className={styles.listTitleWrapper}>
          <Package size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>Servicios ({filteredList.length})</h2>
        </div>
        <div className={styles.actionsWrapper}>
          <div className={styles.searchWrapper}>
            <Icons.Search size={16} className={styles.searchIcon} />
            <input type="text" placeholder="Buscar servicio o proveedor..." className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className={styles.actionIconButton} title="Filtrar"><Icons.Filter size={18} /></button>
          <button className={styles.actionIconButton} title="Exportar servicios"><Icons.Export size={18} /></button>
          {onEnviarValoracion && serviciosList.length > 0 && (
            <button className={styles.actionIconButton} title="Enviar encuesta de satisfacción" onClick={onEnviarValoracion}>
              <Users size={18} />
            </button>
          )}
          {pendingMatchCount > 0 && (
            <button className={styles.actionIconButton} title={`${pendingMatchCount} pago${pendingMatchCount > 1 ? "s" : ""} bancario${pendingMatchCount > 1 ? "s" : ""} pendiente${pendingMatchCount > 1 ? "s" : ""} de conciliar`} style={{ position: "relative" }} onClick={onOpenMatchModal}>
              <Landmark size={18} />
              <span style={{ position: "absolute", top: "-6px", right: "-6px", minWidth: "16px", height: "16px", borderRadius: "8px", backgroundColor: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1, border: "1.5px solid #fff" }}>
                {pendingMatchCount}
              </span>
            </button>
          )}
          <div style={{ position: "relative" }}>
            <button className={styles.addActionButton} title="Añadir" onClick={() => setShowDropdown(!showDropdown)}>
              <Plus size={18} />
            </button>
            {showDropdown && (
              <div style={{ position: "absolute", right: 0, top: "110%", zIndex: 2002, width: "220px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", padding: "0.4rem 0" }}>
                {onRegistrarPago && (
                  <button onClick={() => { setShowDropdown(false); onRegistrarPago(); }} style={{ background: "none", border: "none", width: "100%", padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 500, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Landmark size={14} /> Registrar Pago
                  </button>
                )}
                <div style={{ height: "1px", backgroundColor: "#e2e8f0", margin: "0.35rem 0" }} />
                <button onClick={() => { setShowDropdown(false); onAbrirManual(); }} style={{ background: "none", border: "none", width: "100%", padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 500, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Plus size={14} /> Añadir servicio manual
                </button>
                <button onClick={() => { setShowDropdown(false); onAbrirImportar(); }} style={{ background: "none", border: "none", width: "100%", padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 500, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", borderTop: "1px solid #f1f5f9" }}>
                  <Download size={14} /> Importar de cotización
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", color: "#64748b", fontSize: "0.85rem" }}>
          Buscando servicios del expediente...
        </div>
      ) : filteredList.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem", backgroundColor: "#fff", borderRadius: "0.75rem", textAlign: "center", gap: "0.75rem" }}>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
            {serviciosList.length === 0 ? "No hay servicios en este listado." : "No se encontraron servicios que coincidan con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className={listStyles.tableContainer} style={{ overflow: "visible", boxShadow: "none", border: "none", background: "transparent", padding: 0 }}>
          <table className={styles.table} style={{ tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col />
              <col style={{ width: 160 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 42 }} />
              <col style={{ width: 42 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 56 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ whiteSpace: "nowrap" }}>TIPO</th>
                <th>Descripción</th>
                <th>Proveedor</th>
                <th>Destino</th>
                <th style={{ textAlign: "right" }} title="Plazas"><Users size={13} style={{ display: "inline-block", verticalAlign: "middle" }} /></th>
                <th style={{ textAlign: "right" }} title="Noches"><Moon size={13} style={{ display: "inline-block", verticalAlign: "middle" }} /></th>
                <th style={{ textAlign: "right" }}>Neto</th>
                <th style={{ textAlign: "right" }}>PVP</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Tot. Neto</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Tot. PVP</th>
                <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredList.map((item, index) => {
                const isOpcional = !!item.opcional;
                const isLinked = !!(item.lineas && item.lineas.some((l: any) => l.cotizacion_linea_id));
                const viajerosCount = item.viajeros_count || 0;
                const neto = parseFloat(item.neto) || 0;
                const pvp = parseFloat(item.pvp) || 0;
                // Para opcionales, mientras no se haya editado manualmente (sigue en el valor
                // por defecto de creación = 1) se muestran los viajeros vinculados al servicio.
                const plazas = isOpcional && viajerosCount > 0 && Number(item.plazas || 0) <= 1
                  ? viajerosCount
                  : (item.plazas || 0);
                const noches = Number(item.noches || 0) || 1;

                return (
                  <Fragment key={item.id}>
                    {index === firstOpcionalIndex && (
                      <tr>
                        <td colSpan={12} style={{ padding: "0.75rem 1rem 0.5rem 1rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>OPCIONALES</span>
                            <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }} />
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ whiteSpace: "nowrap", width: "1%", verticalAlign: "middle" }}>
                        <TipoSelectorServicio
                          ser={item}
                          getTypeInfo={getTypeInfo}
                          serviceTypes={serviceTypes}
                          onUpdateTipo={onUpdateTipo}
                          isOpen={openTipoRowId === item.id}
                          onToggle={() => setOpenTipoRowId(openTipoRowId === item.id ? null : item.id)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          key={item.id + "-desc"}
                          defaultValue={item.descripcion ?? ""}
                          onBlur={(e) => onUpdateDescripcion(item.id, e.target.value)}
                          style={{ ...fieldStyle, width: "100%" }}
                        />
                      </td>
                      <td>
                        {item.proveedor && !item.proveedor_id && !unlinkedProviderIds.has(item.id) ? (
                          <div
                            title={`${item.proveedor} (proveedor sin vincular — haz clic para seleccionar uno)`}
                            onClick={() => setUnlinkedProviderIds((prev) => new Set(prev).add(item.id))}
                            style={{ ...fieldStyle, width: "100%", display: "flex", alignItems: "center", cursor: "pointer", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          >
                            {item.proveedor}
                          </div>
                        ) : (
                          <ProviderSelector
                            value={item.proveedor_id ?? ""}
                            label={item.proveedor_id ? item.proveedor : undefined}
                            onChange={(val) => onUpdateProveedor(item.id, val)}
                            compact
                          />
                        )}
                      </td>
                      <td>
                        <DestinationSelector
                          value={item.destino ?? ""}
                          label={(() => { const d = item.maestro_destinos; if (!d) return ""; const name = d.nombre_comercial || d.nombre || ""; const area = d.admin_area_l2 || d.admin_area_l1 || ""; const full = area ? `${name}, ${area}` : name; return full.length > 32 ? full.slice(0, 31) + "…" : full; })()}
                          onChange={(val) => onUpdateDestino(item.id, val || null)}
                          compact
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          type="text"
                          key={item.id + "-plazas"}
                          defaultValue={plazas ?? ""}
                          maxLength={3}
                          title={isOpcional ? "Por defecto: viajeros vinculados a este servicio" : undefined}
                          onBlur={(e) => { const v = e.target.value.replace(/\D/g, ""); onUpdatePlazas(item.id, v ? Number(v) : 0); }}
                          style={{ ...fieldStyle, width: "100%", padding: "0.2rem", textAlign: "right" }}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          type="text"
                          key={item.id + "-noches"}
                          defaultValue={item.noches ?? ""}
                          maxLength={3}
                          onBlur={(e) => { const v = e.target.value.replace(/\D/g, ""); onUpdateNoches(item.id, v ? Number(v) : null); }}
                          style={{ ...fieldStyle, width: "100%", padding: "0.2rem", textAlign: "right" }}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          type="text"
                          key={item.id + "-neto"}
                          defaultValue={!neto ? "" : neto}
                          onBlur={(e) => onUpdateImporte(item.id, parseFloat(e.target.value.replace(",", ".")) || 0, undefined)}
                          style={{ ...fieldStyle, width: "100%", padding: "0.2rem", textAlign: "right" }}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          type="text"
                          key={item.id + "-pvp"}
                          defaultValue={!pvp ? "" : pvp}
                          onBlur={(e) => onUpdateImporte(item.id, undefined, parseFloat(e.target.value.replace(",", ".")) || 0)}
                          style={{ ...fieldStyle, width: "100%", padding: "0.2rem", textAlign: "right" }}
                        />
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap", verticalAlign: "middle", fontSize: "0.75rem" }}>
                        {(neto * plazas * noches).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap", verticalAlign: "middle", fontSize: "0.75rem", fontWeight: 600 }}>
                        {(pvp * plazas * noches).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                      </td>
                      <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                        <EstadoPagoBadge abonado={Number(item.abonado ?? 0)} pvp={pvp * plazas * noches} />
                      </td>
                      <td style={{ verticalAlign: "middle", width: "1%", whiteSpace: "nowrap", position: "relative" }}>
                        {deleteConfirmId === item.id ? (
                          <div style={{ display: "flex", gap: "4px", alignItems: "center", justifyContent: "flex-end", background: "#fef2f2", border: "1px solid #fca5a5", padding: "2px 6px", borderRadius: "4px", whiteSpace: "nowrap", position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 20 }}>
                            <span style={{ fontSize: "0.65rem", color: "#b91c1c", fontWeight: "bold", whiteSpace: "nowrap" }}>¿Eliminar?</span>
                            <button type="button" style={{ border: "none", background: "#ef4444", color: "#fff", borderRadius: "3px", padding: "1px 4px", fontSize: "0.62rem", cursor: "pointer", fontWeight: "bold" }} onClick={() => { onDeleteServicio(item.id); setDeleteConfirmId(null); }}>Sí</button>
                            <button type="button" style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#475569", borderRadius: "3px", padding: "1px 4px", fontSize: "0.62rem", cursor: "pointer" }} onClick={() => setDeleteConfirmId(null)}>No</button>
                          </div>
                        ) : (
                          <AccionesLineaCell
                            rowId={item.id}
                            isLinked={isLinked}
                            linkTitleLinked="Vinculado a cotización"
                            linkTitleUnlinked="No vinculado a ninguna cotización"
                            onLinkClick={onVincularCotizacion ? () => onVincularCotizacion(item.id) : undefined}
                            saveStatus={saveStatus[item.id]}
                            actions={[
                              ...(onOpenInfo ? [{ icon: <Info size={13} />, title: "Formulario del servicio", onClick: () => onOpenInfo(item) }] : []),
                              ...(onOpenEmail ? [{ icon: <Mail size={13} />, title: item.proveedor_email ? `Enviar email a ${item.proveedor}` : "Enviar email al proveedor", onClick: () => onOpenEmail(item) }] : []),
                              { icon: <Trash2 size={13} />, title: "Eliminar servicio", onClick: () => setDeleteConfirmId(item.id), danger: true },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { Fragment } from "react";
import { Trash2, Plus, Users, Compass, ArrowLeft, FileText, Landmark } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { FolderPlus } from "lucide-react";
import { Icons } from "@/lib/icons";
import Pagination from "@/app/components/Pagination";
import PagosVinculadosRow from "./PagosVinculadosRow";
import { calculateMargin } from "@/lib/utils/servicios";
import type { useServicios } from "@/hooks/useServicios";
import styles from "@/app/expedientes/shared.module.css";

type ServiciosHook = ReturnType<typeof useServicios>;

interface Props {
  s: ServiciosHook;
  onOpenMatchModal?: () => void;
  onEnviarValoracion?: () => void;
  onExportClick?: (ser: any) => void;
}

function TipoIconServicio({ ser, getTypeInfo }: { ser: any; getTypeInfo: (id: string) => any }) {
  const info = getTypeInfo(ser.tipo);
  const IconComponent = (LucideIcons as any)[info.icono] || FolderPlus;
  const lineas = ser.lineas || [];
  const uniqueTipos = [...new Set(lineas.map((l: any) => l.tipo).filter(Boolean))] as string[];

  const base = (
    <div
      title={info.label}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "color-mix(in srgb, var(--primary-color, #475569), transparent 80%)", color: "var(--primary-color, #475569)", position: "relative" }}
    >
      <IconComponent size={16} />
    </div>
  );

  if (uniqueTipos.length <= 1) return base;

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      {base}
      <span style={{ position: "absolute", top: "-6px", right: "-6px", minWidth: "18px", height: "18px", borderRadius: "9px", backgroundColor: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", lineHeight: 1 }}>
        +{uniqueTipos.length - 1}
      </span>
    </div>
  );
}

function AddMenu({ onAddService, onImportCotizacion, onImportPdf }: { onAddService: () => void; onImportCotizacion: () => void; onImportPdf: () => void }) {
  const items = [
    { icon: <Plus size={14} />, label: "Nuevo servicio", onClick: onAddService },
    { icon: <ArrowLeft size={14} style={{ transform: "rotate(180deg)" }} />, label: "Importar cotización", onClick: onImportCotizacion, border: true },
    { icon: <FileText size={14} />, label: "Importar PDF", onClick: onImportPdf, border: true },
  ];
  return (
    <div data-add-menu style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, backgroundColor: "#fff", borderRadius: "0.5rem", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0", zIndex: 2001, overflow: "hidden", minWidth: "190px" }}>
      {items.map(({ icon, label, onClick, border }) => (
        <div key={label} onClick={onClick} style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", cursor: "pointer", color: "#334155", display: "flex", alignItems: "center", gap: "0.4rem", borderTop: border ? "1px solid #f1f5f9" : undefined }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          {icon} {label}
        </div>
      ))}
    </div>
  );
}

export default function TablaServicios({ s, onOpenMatchModal, onEnviarValoracion, onExportClick }: Props) {
  return (
    <div className={styles.tabContainer}>
      {/* Header */}
      <div className={styles.listHeaderTop}>
        <div className={styles.listTitleWrapper}>
          <Icons.Servicios size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>Servicios Contratados ({s.filteredData.length})</h2>
        </div>
        <div className={styles.actionsWrapper}>
          <div className={styles.searchWrapper}>
            <Icons.Search size={16} className={styles.searchIcon} />
            <input type="text" placeholder="Buscar servicio o proveedor..." className={styles.searchInput} value={s.search} onChange={(e) => s.setSearch(e.target.value)} />
          </div>
          <button className={styles.actionIconButton} title="Filtrar"><Icons.Filter size={18} /></button>
          <button className={styles.actionIconButton} title="Exportar servicios"><Icons.Export size={18} /></button>
          {onEnviarValoracion && s.servicios.length > 0 && (
            <button className={styles.actionIconButton} title="Enviar encuesta de satisfacción" onClick={onEnviarValoracion}>
              <Users size={18} />
            </button>
          )}
          {s.pendingMatchCount > 0 && (
            <button className={styles.actionIconButton} title={`${s.pendingMatchCount} pago${s.pendingMatchCount > 1 ? "s" : ""} bancario${s.pendingMatchCount > 1 ? "s" : ""} pendiente${s.pendingMatchCount > 1 ? "s" : ""} de conciliar`} style={{ position: "relative" }} onClick={onOpenMatchModal}>
              <Landmark size={18} />
              <span style={{ position: "absolute", top: "-6px", right: "-6px", minWidth: "16px", height: "16px", borderRadius: "8px", backgroundColor: "var(--primary-color, #475569)", color: "#fff", fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1, border: "1.5px solid #fff" }}>
                {s.pendingMatchCount}
              </span>
            </button>
          )}
          <div style={{ position: "relative" }}>
            <button data-add-btn className={styles.addActionButton} onClick={() => s.setShowAddMenu(!s.showAddMenu)}><Icons.Add size={18} /></button>
            {s.showAddMenu && (
              <AddMenu
                onAddService={() => { s.setShowAddMenu(false); s.openAddService(); }}
                onImportCotizacion={() => { s.setShowAddMenu(false); s.openImportCotizacion(); }}
                onImportPdf={() => { s.setShowAddMenu(false); s.openImportPdf(); }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      {s.loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", color: "#64748b", fontSize: "0.85rem" }}>
          Cargando servicios del expediente...
        </div>
      ) : s.visibleServicios.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 1.5rem", backgroundColor: "#fff", borderRadius: "0.75rem", border: "1px dashed #cbd5e1", textAlign: "center", gap: "1rem", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)", marginTop: "1rem" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}><Compass size={24} /></div>
          <div>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a", margin: "0 0 0.25rem 0" }}>
              {s.hasOptionalOnly ? "No hay servicios obligatorios activos" : "No hay servicios contratados"}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0, maxWidth: "380px" }}>
              {s.hasOptionalOnly ? "Actualmente sólo hay servicios opcionales en el expediente." : "Añade transportes, alojamientos o actividades para estructurar el viaje."}
            </p>
          </div>
          <button onClick={s.openAddService} style={{ backgroundColor: "var(--primary-color, #475569)", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "0.375rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Plus size={14} /> Añadir primer servicio
          </button>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: "32px" }} />
                <th style={{ width: "60px", textAlign: "center" }}><span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b" }}>TIPO</span></th>
                {["SERVICIO / PROVEEDOR", "CARÁCTER", "PRECIO (NETO / PVP)", "ABONADO", "MARGEN BENEFICIO"].map(h => (
                  <th key={h}><div className={styles.headerSort}><span>{h}</span><Icons.ChevronDown size={12} className={styles.sortIcon} /></div></th>
                ))}
                <th style={{ textAlign: "right" }} />
              </tr>
            </thead>
            <tbody>
              {s.paginatedData.map((ser) => {
                const { margin, marginPercent } = calculateMargin(ser.pvp, ser.neto);
                const isExpanded = s.expandedServicios.has(ser.id);
                const pagos = ser.pagos || [];
                const match = s.getMatch(ser);
                const typeInfo = s.getTypeInfo(ser.tipo);
                const isAlojamiento = typeInfo.id === "alojamiento" || typeInfo.label.toLowerCase().includes("alojamiento");
                return (
                  <Fragment key={ser.id}>
                    <tr style={{ borderBottom: isExpanded ? "none" : "1px solid #f1f5f9" }}>
                      <td style={{ width: "1%", padding: "0.25rem", textAlign: "center" }}>
                        <button onClick={() => s.toggleExpand(ser.id)} disabled={pagos.length === 0} title={pagos.length > 0 ? (isExpanded ? "Ocultar movimientos" : "Ver movimientos bancarios") : "Sin movimientos"} style={{ background: "transparent", border: "none", cursor: pagos.length > 0 ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0.25rem", color: pagos.length > 0 ? "#64748b" : "#e2e8f0", outline: "none" }}>
                          <Icons.ChevronDown size={16} style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                        </button>
                      </td>
                      <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
                          <TipoIconServicio ser={ser} getTypeInfo={s.getTypeInfo} />
                          {ser.match_score && <span style={{ position: "absolute", top: "-4px", right: "-4px", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981", border: "1px solid #fff" }} />}
                        </div>
                      </td>
                      <td>
                        <div className={styles.stackedCell}>
                          <span className={styles.mainText} style={{ fontWeight: 600, color: "#0f172a" }}>{ser.descripcion}</span>
                          <span className={styles.subText} style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                            {ser.proveedor || <span style={{ fontStyle: "italic", color: "#94a3b8" }}>Sin proveedor</span>}
                          </span>
                        </div>
                      </td>
                      <td>
                        {ser.opcional ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                            <span style={{ display: "inline-flex", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", backgroundColor: "#fdf2f8", color: "#db2777", fontSize: "0.75rem", fontWeight: 600, alignSelf: "flex-start" }}>OPCIONAL</span>
                            {ser.minimo_plazas && <span style={{ fontSize: "0.7rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.2rem" }}><Users size={10} /> Mín. {ser.minimo_plazas} plazas</span>}
                          </div>
                        ) : (
                          <span style={{ display: "inline-flex", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", backgroundColor: "#f0fdf4", color: "#16a34a", fontSize: "0.75rem", fontWeight: 600 }}>GENERAL</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 600, color: "#0f172a" }}>{ser.pvp.toLocaleString("es-ES", { minimumFractionDigits: 2 })} € <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "normal" }}>PVP</span></span>
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{ser.neto.toLocaleString("es-ES", { minimumFractionDigits: 2 })} € <span style={{ fontSize: "0.7rem" }}>Neto</span></span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: (ser.abonado ?? 0) >= ser.pvp ? "#16a34a" : (ser.abonado ?? 0) > 0 ? "#d97706" : "#94a3b8" }}>
                          {(ser.abonado ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 600, color: margin >= 0 ? "#16a34a" : "#dc2626" }}>{margin.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{marginPercent}% margen</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          {match && (
                            <button onClick={() => s.openMatchBancario(match)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0.4rem", borderRadius: "0.25rem", position: "relative", transition: "color 0.15s, background-color 0.15s" }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--primary-color, #475569)"; e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.backgroundColor = "transparent"; }}
                              title="Match bancario pendiente"
                            >
                              <Landmark size={16} />
                              <span style={{ position: "absolute", top: 0, right: 0, color: "var(--primary-color, #475569)", fontSize: "0.5rem", lineHeight: 1 }}>
                                <LucideIcons.Sparkles size={10} fill="var(--primary-color, #475569)" />
                              </span>
                            </button>
                          )}
                          {isAlojamiento && (
                            <button onClick={() => onExportClick?.(ser)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0.4rem", borderRadius: "0.25rem", transition: "color 0.15s, background-color 0.15s" }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--primary-color, #475569)"; e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.backgroundColor = "transparent"; }}
                              title="Exportar viajeros para este alojamiento"
                            >
                              <Icons.Export size={16} />
                            </button>
                          )}
                          <button onClick={() => s.openEditService(ser)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0.4rem", borderRadius: "0.25rem", transition: "color 0.15s, background-color 0.15s" }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--primary-color, #475569)"; e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.backgroundColor = "transparent"; }}
                            title="Editar servicio"
                          >
                            <LucideIcons.Edit size={16} />
                          </button>
                          <button onClick={() => s.handleDelete(ser.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0.4rem", borderRadius: "0.25rem", transition: "color 0.15s, background-color 0.15s" }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.backgroundColor = "#fef2f2"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.backgroundColor = "transparent"; }}
                            title="Eliminar servicio"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && pagos.length > 0 && <PagosVinculadosRow pagos={pagos} />}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {s.filteredData.length > 0 && (
            <Pagination currentPage={s.currentPage} totalItems={s.filteredData.length} itemsPerPage={s.rowsPerPage} onPageChange={s.setCurrentPage} onItemsPerPageChange={s.setRowsPerPage} />
          )}
        </div>
      )}
    </div>
  );
}

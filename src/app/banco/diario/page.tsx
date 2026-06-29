"use client";

import { Suspense } from "react";
import { Icons } from "@/lib/icons";
import Pagination from "@/app/components/Pagination";
import { useLibroDiario } from "@/hooks/useLibroDiario";
import FiltrosDiario from "./FiltrosDiario";
import VistaAsiento from "./VistaAsiento";
import VistaApunte from "./VistaApunte";
import listStyles from "../../expedientes/page.module.css";
import s from "./diario.module.css";

function LibroDiarioContent() {
  const d = useLibroDiario();

  return (
    <div className={listStyles.container}>
      <header className={listStyles.header}>
        <div className={listStyles.headerRow}>
          <h1 className={listStyles.title}>Libro Diario</h1>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <FiltrosDiario
          filtros={d.filtros}
          ejercicios={d.ejercicios}
          cuentasContables={d.cuentasContables}
          searchInput={d.searchInput}
          loading={d.loading}
          onSearchChange={d.setSearchInput}
          onUpdateFiltro={d.updateFiltro}
          onReset={d.resetFiltros}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>
              {d.vista === "asiento"
                ? `Mostrando ${d.asientos.length} asientos (total: ${d.totalItems})`
                : `Mostrando ${d.apuntesPlanos.length} apuntes (total: ${d.totalItems})`}
            </span>
            <div className={s.vistaToggle}>
              {([["asiento", "Vista Asiento", Icons.Asiento], ["apunte", "Vista Apunte", Icons.Apunte]] as const).map(([key, label, Ico]) => (
                <button key={key} onClick={() => d.setVista(key)} className={`${s.vistaBtn} ${d.vista === key ? s.vistaBtnActive : ""}`}>
                  <Ico size={12} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {d.loading ? (
            <div style={{ background: "#fff", borderRadius: "0.75rem", border: "1px solid #f1f5f9", padding: "4rem 2rem", textAlign: "center", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)" }}>
              <span className={s.spinnerLg} style={{ display: "inline-block", marginBottom: "1rem" }} />
              <div style={{ fontWeight: 600, color: "#475569" }}>Cargando Libro Diario...</div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "0.25rem" }}>Procesando asientos y conciliaciones</div>
            </div>
          ) : d.asientos.length === 0 && d.pendientes.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: "0.75rem", border: "1px solid #f1f5f9", padding: "4rem 2rem", textAlign: "center", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)" }}>
              <Icons.Book size={40} style={{ color: "#94a3b8", marginBottom: "1rem" }} />
              <div style={{ fontWeight: 700, color: "#334155", fontSize: "1rem" }}>No se encontraron asientos contables</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem", maxWidth: "400px", marginInline: "auto" }}>
                Ajusta los criterios de búsqueda o limpia los filtros activos.
              </div>
            </div>
          ) : d.vista === "asiento" ? (
            <VistaAsiento asientos={d.asientos} onUpdateFiltro={d.updateFiltro} />
          ) : (
            <VistaApunte apuntes={d.apuntesPlanos} onUpdateFiltro={d.updateFiltro} />
          )}

          {!d.loading && d.totalItems > 0 && (
            <Pagination
              currentPage={d.currentPage}
              totalItems={d.totalItems}
              itemsPerPage={d.rowsPerPage}
              onPageChange={d.setCurrentPage}
              onItemsPerPageChange={d.setRowsPerPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function LibroDiarioPage() {
  return (
    <Suspense fallback={null}>
      <LibroDiarioContent />
    </Suspense>
  );
}

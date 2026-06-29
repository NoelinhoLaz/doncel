"use client";

import { useState } from "react";
import { Icons } from "@/lib/icons";
import { formatEuro } from "@/lib/utils/currency";
import Pagination from "@/app/components/Pagination";
import type { FacturaEmitida } from "@/actions/facturacion";
import styles from "@/app/expedientes/[id]/page.module.css";

interface Props {
  facturas: FacturaEmitida[];
  loading: boolean;
  filteredFacturas: FacturaEmitida[];
  paginatedFacturas: FacturaEmitida[];
  search: string;
  onSearchChange: (v: string) => void;
  currentPage: number;
  rowsPerPage: number;
  onPageChange: (p: number) => void;
  onRowsPerPageChange: (r: number) => void;
  onAddFactura: () => void;
}

export default function TablaFacturas({
  facturas,
  loading,
  filteredFacturas,
  paginatedFacturas,
  search,
  onSearchChange,
  currentPage,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  onAddFactura,
}: Props) {
  const [selectedQr, setSelectedQr] = useState<string | null>(null);

  return (
    <>
      <div className={styles.tabContainer}>
        <div className={styles.listHeaderTop}>
          <div className={styles.listTitleWrapper}>
            <Icons.Facturacion size={18} className={styles.titleIcon} />
            <h2 className={styles.listTitle}>
              Facturación ({loading ? "..." : facturas.length})
            </h2>
          </div>
          <div className={styles.actionsWrapper}>
            <div className={styles.searchWrapper}>
              <Icons.Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Buscar factura..."
                className={styles.searchInput}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            <button className={styles.actionIconButton} title="Filtrar">
              <Icons.Filter size={18} />
            </button>
            <button className={styles.actionIconButton} title="Exportar">
              <Icons.Export size={18} />
            </button>
            <button className={styles.addActionButton} title="Facturar Cobros" onClick={onAddFactura}>
              <Icons.Add size={18} />
            </button>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8", fontSize: "0.85rem" }}>
              Cargando facturas...
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  {[
                    { label: "FECHA", style: { width: "1%", whiteSpace: "nowrap" as const } },
                    { label: "FACTURA", style: { width: "1%", whiteSpace: "nowrap" as const } },
                    { label: "CLIENTE", style: { minWidth: "200px" } },
                    { label: "NIF", style: { width: "1%", whiteSpace: "nowrap" as const } },
                    { label: "CONCEPTO", style: {} },
                    { label: "RÉGIMEN", style: { width: "1%", whiteSpace: "nowrap" as const } },
                    { label: "BASE IMP.", style: { width: "1%", whiteSpace: "nowrap" as const } },
                    { label: "I.V.A.", style: { width: "1%", whiteSpace: "nowrap" as const } },
                    { label: "TOTAL", style: { width: "1%", whiteSpace: "nowrap" as const, textAlign: "right" as const } },
                    { label: "AEAT", style: { width: "1%", whiteSpace: "nowrap" as const } },
                  ].map(({ label, style }) => (
                    <th key={label} style={style}>
                      <div className={styles.headerSort} style={style.textAlign ? { justifyContent: "flex-end" } : undefined}>
                        <span>{label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedFacturas.map((f) => {
                  const linea = f.lineas?.[0];
                  const base = linea ? linea.importe_neto : f.importe_total;
                  const iva = linea ? linea.cuota_iva : 0;
                  const isReav = f.regimen_iva === "REAV";
                  return (
                    <tr key={f.id} style={{ height: "44px" }}>
                      <td style={{ whiteSpace: "nowrap", verticalAlign: "middle" }}>
                        {new Date(f.fecha_emision).toLocaleDateString("es-ES")}
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontFamily: "monospace", fontSize: "0.78rem", verticalAlign: "middle" }}>
                        {f.numero_factura}
                      </td>
                      <td style={{ verticalAlign: "middle" }}>{f.cliente_nombre}</td>
                      <td style={{ whiteSpace: "nowrap", fontFamily: "monospace", fontSize: "0.78rem", color: "#64748b", verticalAlign: "middle" }}>
                        {f.cliente_nif}
                      </td>
                      <td style={{ color: "#64748b", fontSize: "0.78rem", verticalAlign: "middle", width: "100%", wordBreak: "break-word" }}>
                        {linea?.concepto || "—"}
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "9999px", background: isReav ? "#eef2ff" : "#ecfdf5", color: isReav ? "#6366f1" : "#059669" }}>
                          {f.regimen_iva}
                        </span>
                      </td>
                      <td style={{ verticalAlign: "middle" }}>{formatEuro(base)}</td>
                      <td style={{ verticalAlign: "middle" }}>
                        {isReav ? <span style={{ color: "#94a3b8" }}>Incluido</span> : formatEuro(iva)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "#1e293b", verticalAlign: "middle" }}>
                        {formatEuro(f.importe_total)}
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          {f.verifactu_qr ? (
                            <div
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", border: "1px solid #cbd5e1", borderRadius: "6px", overflow: "hidden", background: "#ffffff", cursor: "pointer", transition: "all 0.2s ease", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                              title="Haz clic para ampliar"
                              onClick={() => setSelectedQr(f.verifactu_qr || null)}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.borderColor = "var(--primary-color, #475569)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                            >
                              <img src={f.verifactu_qr} alt="QR Verifactu" style={{ width: "22px", height: "22px", objectFit: "contain" }} />
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.74rem", color: "#94a3b8" }}>—</span>
                          )}
                          <div
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", color: "#64748b", transition: "all 0.2s ease", background: "#ffffff" }}
                            title="Descargar PDF"
                            onClick={() => window.open(`/api/facturacion/generar-doc/${f.id}`)}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "var(--primary-color, #475569)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.color = "#64748b"; }}
                          >
                            <Icons.Download size={14} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedFacturas.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", color: "#94a3b8", padding: "3rem" }}>
                      {search ? "No se encontraron facturas con ese criterio." : "No hay facturas emitidas para este expediente."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {filteredFacturas.length > rowsPerPage && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredFacturas.length}
              itemsPerPage={rowsPerPage}
              onPageChange={onPageChange}
              onItemsPerPageChange={(n) => onRowsPerPageChange(n)}
            />
          )}
        </div>
      </div>

      {/* QR viewer */}
      {selectedQr && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
          onClick={() => setSelectedQr(null)}
        >
          <div
            style={{ background: "#ffffff", padding: "1.5rem", borderRadius: "1.2rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", maxWidth: "320px", width: "90%", border: "1px solid #e2e8f0" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", margin: 0, textAlign: "center" }}>
              Código QR Veri*Factu
            </h4>
            <div style={{ width: "180px", height: "180px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", padding: "0.5rem" }}>
              <img src={selectedQr} alt="QR Verifactu Ampliado" style={{ width: "160px", height: "160px", objectFit: "contain" }} />
            </div>
            <p style={{ fontSize: "0.68rem", color: "#64748b", margin: 0, textAlign: "center", lineHeight: 1.4 }}>
              Este código certifica que la factura ha sido declarada correctamente ante la Agencia Tributaria.
            </p>
            <button
              onClick={() => setSelectedQr(null)}
              style={{ background: "var(--primary-color, #475569)", color: "#ffffff", border: "none", borderRadius: "0.6rem", padding: "0.45rem 1rem", fontSize: "0.74rem", fontWeight: 600, cursor: "pointer", width: "100%", textAlign: "center" }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

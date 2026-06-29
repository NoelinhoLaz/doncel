"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Mail, Search, Download, Plus, Paperclip } from "lucide-react";
import Pagination from "@/app/components/Pagination";
import { getComunicacionesByExpediente } from "@/actions/comunicaciones";
import { ComunicacionDB, TabSegmento } from "./comunicaciones.types";
import { FilaComunicacion } from "./ComunicacionesTabla";
import NuevaComunicacionModal from "./NuevaComunicacionModal";
import styles from "../page.module.css";

interface Props {
  expedienteId: string;
  pagadores?: any[];
}

export default function ComunicacionesTab({ expedienteId, pagadores = [] }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [tabSegmento, setTabSegmento] = useState<TabSegmento>("todas");
  const [comunicaciones, setComunicaciones] = useState<ComunicacionDB[]>([]);
  const [loadingComunicaciones, setLoadingComunicaciones] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const loadComunicaciones = useCallback(async () => {
    setLoadingComunicaciones(true);
    const res = await getComunicacionesByExpediente(expedienteId);
    if (res.success) setComunicaciones(res.data as ComunicacionDB[]);
    setLoadingComunicaciones(false);
  }, [expedienteId]);

  useEffect(() => { loadComunicaciones(); }, [loadComunicaciones]);

  const filteredByTab = useMemo(() => {
    if (tabSegmento === "financieras") return comunicaciones.filter((c) => c.canal === "email");
    if (tabSegmento === "operativas") return comunicaciones.filter((c) => c.canal === "whatsapp");
    return comunicaciones;
  }, [comunicaciones, tabSegmento]);

  const filteredData = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return filteredByTab;
    return filteredByTab.filter((item) =>
      [item.asunto || "", item.cuerpo, ...item.destinatarios.map((d) => `${d.nombre} ${d.email}`)]
        .join(" ").toLowerCase().includes(q)
    );
  }, [filteredByTab, search]);

  const paginatedData = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const countEmail = comunicaciones.filter((c) => c.canal === "email").length;
  const countWa = comunicaciones.filter((c) => c.canal === "whatsapp").length;

  return (
    <div className={styles.tabContainer}>
      {/* Cabecera */}
      <div className={styles.listHeaderTop}>
        <div className={styles.listTitleWrapper}>
          <Mail size={18} className={styles.titleIcon} />
          <h2 className={styles.listTitle}>Registro de Comunicaciones ({filteredData.length})</h2>
        </div>
        <div className={styles.actionsWrapper}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por destinatario o asunto..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <button className={styles.actionIconButton} title="Exportar log"><Download size={18} /></button>
          <button className={styles.addActionButton} title="Redactar comunicación" onClick={() => setModalOpen(true)}>
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0", borderBottom: "2px solid #f1f5f9", marginBottom: "0" }}>
        {([
          { id: "todas" as TabSegmento, label: "Todas", count: comunicaciones.length },
          { id: "financieras" as TabSegmento, label: "Financieras / Email", count: countEmail },
          { id: "operativas" as TabSegmento, label: "Operativas / WhatsApp", count: countWa },
        ] as const).map(({ id, label, count }) => {
          const active = tabSegmento === id;
          return (
            <button key={id} onClick={() => { setTabSegmento(id); setCurrentPage(1); }}
              style={{ padding: "0.6rem 1.1rem", background: "none", border: "none", borderBottom: active ? "2px solid var(--primary-color, #475569)" : "2px solid transparent", marginBottom: "-2px", color: active ? "var(--primary-color, #475569)" : "#94a3b8", fontWeight: active ? "700" : "500", fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {label}
              {count > 0 && (
                <span style={{ background: active ? "var(--primary-color, #475569)" : "#e2e8f0", color: active ? "#fff" : "#64748b", borderRadius: "10px", padding: "0.05rem 0.45rem", fontSize: "0.68rem", fontWeight: "700" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tabla */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: "80px" }}>CANAL</th>
              <th>DESTINATARIO</th>
              <th>ASUNTO / MENSAJE</th>
              <th style={{ width: "60px", textAlign: "center" }}><Paperclip size={13} /></th>
              <th>FECHA / HORA</th>
              <th style={{ textAlign: "right" }}>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            {loadingComunicaciones ? (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: "2rem" }}>Cargando comunicaciones...</td></tr>
            ) : paginatedData.map((item) => (
              <FilaComunicacion key={item.id} item={item} />
            ))}
            {!loadingComunicaciones && paginatedData.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "#64748b", padding: "3rem 2rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                    <Mail size={32} style={{ color: "#cbd5e1" }} />
                    <span style={{ fontSize: "0.85rem" }}>No hay comunicaciones registradas</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filteredData.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredData.length}
            itemsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(n) => { setRowsPerPage(n); setCurrentPage(1); }}
          />
        )}
      </div>

      {modalOpen && (
        <NuevaComunicacionModal
          expedienteId={expedienteId}
          pagadores={pagadores}
          onClose={() => setModalOpen(false)}
          onSent={loadComunicaciones}
        />
      )}
    </div>
  );
}

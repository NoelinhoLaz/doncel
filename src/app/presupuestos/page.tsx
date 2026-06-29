"use client";

import listStyles from "../expedientes/page.module.css";
import styles from "../expedientes/[id]/page.module.css";
import { Icons } from "@/lib/icons";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Pagination from "@/app/components/Pagination";
import NuevoPresupuestoModal from "./NuevoPresupuestoModal";

const TIPO_LABELS: Record<string, string> = {
  vacacional: "Vacacional",
  P2P: "P2P",
  grupo: "Grupo",
};

const TIPO_COLORS: Record<string, { bg: string; color: string }> = {
  vacacional: { bg: "#fef3c7", color: "#b45309" },
  P2P:        { bg: "#e0e7ff", color: "#4338ca" },
  grupo:      { bg: "#d1fae5", color: "#065f46" },
};

const ESTADO_MAP: Record<string, { bg: string; color: string; label: string }> = {
  borrador:          { bg: "#f1f5f9", color: "#64748b", label: "Borrador" },
  pendiente_cotizar: { bg: "#dbeafe", color: "#2563eb", label: "Pendiente cotizar" },
  cotizado:          { bg: "#dcfce7", color: "#16a34a", label: "Cotizado" },
  descartado:        { bg: "#fee2e2", color: "#dc2626", label: "Descartado" },
};

export default function PresupuestosPage() {
  const router = useRouter();
  const [presupuestos, setPresupuestos] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [presupuestoEditar, setPresupuestoEditar] = useState<any>(null);
  const [destinosMap, setDestinosMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/destinos").then(r => r.json()).then(j => {
      if (j?.success) {
        const map: Record<string, string> = {};
        for (const d of j.data ?? []) map[d.id] = d.nombre_comercial || d.nombre;
        setDestinosMap(map);
      }
    }).catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    fetch("/api/presupuestos")
      .then((r) => r.json())
      .then((j) => {
        if (j?.success) setPresupuestos(j.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return presupuestos;
    const q = search.toLowerCase();
    return presupuestos.filter((p: any) =>
      (p.titulo_viaje || "").toLowerCase().includes(q) ||
      (p.cliente_nombre || "").toLowerCase().includes(q) ||
      (p.destino_label || "").toLowerCase().includes(q) ||
      (p.tipo_presupuesto || "").toLowerCase().includes(q)
    );
  }, [presupuestos, search]);

  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-ES");
  };

  return (
    <div className={listStyles.container}>
      <header className={listStyles.header} style={{ marginBottom: "0px" }}>
        <div className={listStyles.headerRow}>
          <h1 className={listStyles.title}>Solicitudes de presupuestos</h1>
        </div>
      </header>

      <div style={{
        background: "#ffffff", borderRadius: "0.75rem",
        border: "1px solid #f1f5f9", overflow: "hidden",
        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)", marginTop: "-1rem",
      }}>
        <div className={styles.listHeaderTop} style={{ marginBottom: "0" }}>
          <div className={styles.listTitleWrapper}>
            <Icons.Presupuestos size={18} className={styles.titleIcon} />
            <h2 className={styles.listTitle}>Presupuestos ({filtered.length})</h2>
          </div>
          <div className={styles.actionsWrapper}>
            <div className={styles.searchWrapper}>
              <Icons.Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Buscar por cliente, destino o tipo..."
                className={styles.searchInput}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <button
              className={styles.addActionButton}
              title="Nuevo presupuesto"
              onClick={() => { setPresupuestoEditar(null); setShowModal(true); }}
            >
              <Icons.Add size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
            Cargando presupuestos...
          </div>
        ) : (
          <>
            <table className={styles.table} style={{ paddingLeft: "1rem" }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: "1rem" }}>Cliente</th>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Destino</th>
                  <th>Salida estimada</th>
                  <th style={{ textAlign: "right" }}>Noches</th>
                  <th style={{ textAlign: "right" }}>Plazas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#94a3b8", padding: "2.5rem" }}>
                      No hay presupuestos todavía. Crea uno con el botón +.
                    </td>
                  </tr>
                ) : (
                  paginated.map((p: any) => {
                    const estado = ESTADO_MAP[p.estado] ?? ESTADO_MAP.borrador;
                    const tipo = TIPO_COLORS[p.tipo_presupuesto] ?? { bg: "#f1f5f9", color: "#64748b" };
                    return (
                      <tr
                        key={p.id}
                        className={styles.clickableRow}
                        onClick={() => { setPresupuestoEditar(p); setShowModal(true); }}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ paddingLeft: "1rem" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                            {p.cliente_nombre || "—"}
                          </span>
                          {p.contacto_principal && (
                            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                              {[p.contacto_principal.nombre, p.contacto_principal.apellidos].filter(Boolean).join(" ")}
                              {p.contacto_principal.cargo ? ` · ${p.contacto_principal.cargo}` : ""}
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: "0.85rem", color: "#1e293b" }}>{p.titulo_viaje || "—"}</span>
                        </td>
                        <td>
                          <span style={{
                            display: "inline-block", padding: "0.18rem 0.55rem",
                            borderRadius: "0.4rem", fontSize: "0.7rem", fontWeight: 700,
                            backgroundColor: tipo.bg, color: tipo.color,
                          }}>
                            {TIPO_LABELS[p.tipo_presupuesto] ?? p.tipo_presupuesto}
                          </span>
                        </td>
                        <td>
                          {(() => {
                            const ids: string[] = p.destino_ids ?? [];
                            if (!ids.length) return <span style={{ color: "#94a3b8" }}>—</span>;
                            const nombres = ids.map((id: string) => destinosMap[id]).filter(Boolean);
                            const first = nombres[0] ?? "—";
                            const extra = nombres.length - 1;
                            return (
                              <span style={{ fontSize: "0.82rem", color: "#475569" }}>
                                {first}
                                {extra > 0 && (
                                  <span style={{ marginLeft: "0.3rem", fontSize: "0.7rem", fontWeight: 700, color: "#6366f1", background: "#eef2ff", borderRadius: "99px", padding: "0.1rem 0.4rem" }}>
                                    +{extra}
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                        </td>
                        <td>
                          <span style={{ fontSize: "0.8rem", color: "#1e293b", whiteSpace: "nowrap" }}>
                            {formatDate(p.fecha_salida_estimada)}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {p.noches_estimadas
                            ? <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b" }}>{p.noches_estimadas}<span style={{ fontSize: "0.68rem", fontWeight: 400, color: "#94a3b8", marginLeft: "0.2rem" }}>n</span></span>
                            : <span style={{ color: "#94a3b8" }}>—</span>
                          }
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                            {p.plazas_estimadas}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: "inline-block", padding: "0.2rem 0.6rem",
                            borderRadius: "0.5rem", fontSize: "0.7rem", fontWeight: 600,
                            backgroundColor: estado.bg, color: estado.color,
                          }}>
                            {estado.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <Pagination
              currentPage={currentPage}
              totalItems={filtered.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
            />
          </>
        )}
      </div>

      {showModal && (
        <NuevoPresupuestoModal
          presupuesto={presupuestoEditar ?? undefined}
          onClose={() => { setShowModal(false); setPresupuestoEditar(null); }}
          onCreated={(resultado) => {
            setShowModal(false);
            setPresupuestoEditar(null);
            load();
          }}
        />
      )}
    </div>
  );
}

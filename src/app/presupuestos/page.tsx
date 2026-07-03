"use client";

import listStyles from "../expedientes/page.module.css";
import styles from "../expedientes/[id]/page.module.css";
import { Icons } from "@/lib/icons";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Pagination from "@/app/components/Pagination";
import { Sun, Moon, Users } from "lucide-react";

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
  cotizando:         { bg: "#fef9c3", color: "#a16207", label: "Cotizando" },
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
  const [cotizando, setCotizando] = useState<string | null>(null);
  const [destinosMap, setDestinosMap] = useState<Record<string, string>>({});
  const [agentesMap, setAgentesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/destinos").then(r => r.json()).then(j => {
      if (j?.success) {
        const map: Record<string, string> = {};
        for (const d of j.data ?? []) map[d.id] = d.nombre_comercial || d.nombre;
        setDestinosMap(map);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/usuarios").then(r => r.json()).then(j => {
      const lista = j?.data ?? j?.users ?? j ?? [];
      const map: Record<string, string> = {};
      for (const u of lista) {
        const nombre = [u.nombre, u.apellidos].filter(Boolean).join(" ");
        if (u.id) map[u.id] = nombre;
        if (u.auth_user_id) map[u.auth_user_id] = nombre;
      }
      setAgentesMap(map);
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

  async function handleCotizar(e: React.MouseEvent, p: any) {
    e.stopPropagation();
    if (cotizando) return;
    setCotizando(p.id);
    try {
      const res = await fetch("/api/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: p.titulo_viaje,
          presupuesto_id: p.id,
          plazas: p.plazas_estimadas ?? null,
          fecha_salida: p.fecha_salida_estimada ?? null,
          fecha_regreso: p.fecha_regreso_estimada ?? null,
          pvp_viajero: p.pvp_estimado ?? null,
          contacto: p.entidad_id ?? null,
        }),
      });
      const j = await res.json();
      if (j?.success && j?.data?.id) {
        load();
        router.push(`/cotizaciones/nueva?id=${j.data.id}`);
      }
    } catch {}
    setCotizando(null);
  }

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
              onClick={() => router.push("/presupuestos/nuevo")}
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
                  <th style={{ paddingLeft: "1rem" }}>Agente</th>
                  <th>Cliente</th>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Destino</th>
                  <th>Salida estimada</th>
                  <th style={{ textAlign: "right" }} title="Días / Noches">
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "2px", justifyContent: "flex-end" }}>
                      <Sun size={12} />/<Moon size={12} />
                    </div>
                  </th>
                  <th style={{ textAlign: "right" }} title="Plazas"><Users size={13} style={{ display: 'inline' }} /></th>
                  <th style={{ textAlign: "center" }} title="Cotizaciones"><Icons.Facturacion size={14} style={{ display: 'inline' }} /></th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: "center", color: "#94a3b8", padding: "2.5rem" }}>
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
                        onClick={() => router.push(`/presupuestos/nuevo?edit=${p.id}`)}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ paddingLeft: "1rem" }}>
                          {(() => {
                            const nombre = agentesMap[p.agente_id];
                            if (!nombre) return <span style={{ color: "#94a3b8" }}>—</span>;
                            const partes = nombre.trim().split(" ");
                            const ini = partes.map((w: string) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
                            return (
                              <span title={nombre} style={{
                                width: 26, height: 26, borderRadius: "50%",
                                background: "color-mix(in srgb, var(--primary-color, #475569) 15%, white)",
                                color: "var(--primary-color, #475569)",
                                fontSize: "0.6rem", fontWeight: 700,
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                              }}>{ini}</span>
                            );
                          })()}
                        </td>
                        <td style={{ paddingLeft: "0" }}>
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
                          {p.noches_estimadas ? (
                            <span style={{ fontSize: "0.82rem", fontWeight: 400, color: "#1e293b" }}>
                              {p.noches_estimadas + 1} / {p.noches_estimadas}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "#1e293b" }}>
                            {p.plazas_estimadas}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {p.cotizaciones_count > 0 ? (
                            <span 
                              style={{ 
                                display: "inline-block", 
                                padding: "2px 7px", 
                                background: "color-mix(in srgb, var(--primary-color, #6366f1) 12%, transparent)", 
                                color: "var(--primary-color, #4f46e5)", 
                                borderRadius: "12px", 
                                fontSize: "0.72rem", 
                                fontWeight: 600 
                              }}
                            >
                              {p.cotizaciones_count}
                            </span>
                          ) : (
                            <span style={{ color: "#cbd5e1" }}>—</span>
                          )}
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
                        <td style={{ textAlign: "right", paddingRight: "0.75rem" }}>
                          {(p.estado === "pendiente_cotizar" || p.estado === "cotizando") && (
                            <button
                              onClick={(e) => handleCotizar(e, p)}
                              disabled={cotizando === p.id}
                              style={{
                                padding: "0.25rem 0.65rem", fontSize: "0.72rem", fontWeight: 600,
                                borderRadius: "0.4rem", border: "1.5px solid var(--primary-color, #475569)",
                                background: "color-mix(in srgb, var(--primary-color, #475569) 10%, white)",
                                color: "var(--primary-color, #475569)",
                                cursor: cotizando === p.id ? "wait" : "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {cotizando === p.id ? "Creando…" : "Cotizar"}
                            </button>
                          )}
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

    </div>
  );
}

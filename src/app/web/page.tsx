"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import listStyles from "../expedientes/page.module.css";
import { Plus, Trash2, ExternalLink, ChevronDown, Tag } from "lucide-react";
import { getPaginasWeb, crearPaginaWeb, eliminarPaginaWeb, togglePublicadaPaginaWeb, getFormatosWeb, crearFormatoWeb, eliminarFormatoWeb } from "@/actions/paginaWeb";

type Formato = { id: string; nombre: string; slug: string; color?: string | null };
type PaginaRow = { id: string; es_landing: boolean; formato_id: string | null; formato: Formato | null; titulo: string; slug: string; publicada: boolean; created_at: string };

const formatFecha = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "-";
  }
};

export default function PaginasWebListado() {
  const router = useRouter();
  const [paginas, setPaginas] = useState<PaginaRow[]>([]);
  const [formatos, setFormatos] = useState<Formato[]>([]);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [menuCrear, setMenuCrear] = useState(false);
  const [menuFormatos, setMenuFormatos] = useState(false);
  const [nuevoFormato, setNuevoFormato] = useState("");
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [p, f] = await Promise.all([getPaginasWeb(), getFormatosWeb()]);
    setPaginas(p as PaginaRow[]);
    setFormatos(f as Formato[]);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = async (formatoId: string | null) => {
    setCreando(true);
    setMenuCrear(false);
    const formato = formatos.find(f => f.id === formatoId);
    const res = await crearPaginaWeb({ titulo: formato ? `Nueva ${formato.nombre.toLowerCase()}` : "Nueva página", formatoId, modo: "simple" });
    setCreando(false);
    if (res.ok && res.id) router.push(`/web/${res.id}`);
  };

  const borrar = async (id: string) => {
    await eliminarPaginaWeb(id);
    setConfirmarBorrar(null);
    cargar();
  };

  const togglePublicada = async (p: PaginaRow) => {
    await togglePublicadaPaginaWeb(p.id, !p.publicada);
    cargar();
  };

  const crearFormato = async () => {
    const nombre = nuevoFormato.trim();
    if (!nombre) return;
    const res = await crearFormatoWeb({ nombre });
    if (res.ok) {
      setNuevoFormato("");
      cargar();
    }
  };

  const borrarFormato = async (id: string) => {
    await eliminarFormatoWeb(id);
    cargar();
  };

  return (
    <div className={listStyles.container}>
      <header className={listStyles.header} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 className={listStyles.title}>Páginas web</h1>
        <div style={{ display: "flex", gap: "0.5rem", position: "relative" }}>
          <button
            type="button"
            onClick={() => setMenuFormatos(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.5rem 0.9rem", fontSize: "0.85rem", fontWeight: 600, color: "#1e293b", background: "#f1f5f9", border: "none", borderRadius: "0.5rem", cursor: "pointer" }}
          >
            <Tag size={15} /> Formatos
          </button>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              disabled={creando}
              onClick={() => setMenuCrear(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.5rem 0.9rem", fontSize: "0.85rem", fontWeight: 600, color: "#ffffff", background: "#3189F4", border: "none", borderRadius: "0.5rem", cursor: "pointer" }}
            >
              <Plus size={15} /> Nueva página <ChevronDown size={13} />
            </button>
            {menuCrear && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.5rem", boxShadow: "0 10px 15px -3px rgba(15,23,42,0.1)", padding: "0.4rem", minWidth: "180px", zIndex: 20 }}>
                <button
                  type="button"
                  onClick={() => crear(null)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "0.4rem 0.6rem", fontSize: "0.8rem", background: "none", border: "none", borderRadius: "0.375rem", cursor: "pointer", color: "#334155" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  Página suelta
                </button>
                {formatos.length > 0 && <div style={{ borderTop: "1px solid #f1f5f9", margin: "0.3rem 0" }} />}
                {formatos.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => crear(f.id)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "0.4rem 0.6rem", fontSize: "0.8rem", background: "none", border: "none", borderRadius: "0.375rem", cursor: "pointer", color: "#334155" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    {f.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {menuFormatos && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Formatos de página</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {formatos.length === 0 && <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Aún no hay formatos creados.</span>}
            {formatos.map(f => (
              <span key={f.id} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.6rem", borderRadius: "999px", background: "#ffffff", border: "1px solid #e2e8f0", fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
                {f.nombre}
                <button type="button" onClick={() => borrarFormato(f.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", padding: 0 }}>
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", maxWidth: "320px" }}>
            <input
              type="text"
              placeholder="Ej. Blog, Ofertas, Guías..."
              value={nuevoFormato}
              onChange={e => setNuevoFormato(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); crearFormato(); } }}
              style={{ flex: 1, padding: "0.4rem 0.6rem", fontSize: "0.8rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem" }}
            />
            <button type="button" onClick={crearFormato} disabled={!nuevoFormato.trim()} style={{ padding: "0 0.85rem", fontSize: "0.8rem", fontWeight: 600, color: "#ffffff", background: "#1e293b", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}>
              Crear
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <div style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>Cargando…</div>
      ) : paginas.length === 0 ? (
        <div style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>No hay páginas todavía.</div>
      ) : (
        (() => {
          const landing = paginas.filter(p => p.es_landing);
          const sinFormato = paginas.filter(p => !p.es_landing && !p.formato_id);
          const grupos: { key: string; titulo: string; filas: PaginaRow[] }[] = [
            ...(landing.length ? [{ key: "landing", titulo: "Landing", filas: landing }] : []),
            ...formatos.map(f => ({ key: f.id, titulo: f.nombre, filas: paginas.filter(p => p.formato_id === f.id) })).filter(g => g.filas.length > 0),
            ...(sinFormato.length ? [{ key: "sin-formato", titulo: "Sin formato", filas: sinFormato }] : []),
          ];

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {grupos.map(grupo => (
                <div key={grupo.key}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                    {grupo.titulo} <span style={{ fontWeight: 500, color: "#94a3b8" }}>({grupo.filas.length})</span>
                  </div>
                  <div className={listStyles.tableContainer}>
                    <table className={listStyles.table} style={{ tableLayout: "fixed", width: "100%" }}>
                      <colgroup>
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "33%" }} />
                        <col style={{ width: "25%" }} />
                        <col style={{ width: "15%" }} />
                        <col style={{ width: "15%" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Creada</th>
                          <th>Título</th>
                          <th>URL</th>
                          <th>Estado</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.filas.map(p => (
                          <tr key={p.id} style={{ cursor: "pointer" }}>
                            <td onClick={() => router.push(`/web/${p.id}`)}>
                              <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{formatFecha(p.created_at)}</span>
                            </td>
                            <td onClick={() => router.push(`/web/${p.id}`)} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo}</div>
                            </td>
                            <td onClick={() => router.push(`/web/${p.id}`)} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontFamily: "monospace" }}>/{p.es_landing ? "" : `o/${p.slug}`}</span>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); togglePublicada(p); }}
                                style={{
                                  fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "999px", border: "none", cursor: "pointer",
                                  background: p.publicada ? "#dcfce7" : "#f1f5f9",
                                  color: p.publicada ? "#16a34a" : "#64748b",
                                }}
                              >
                                {p.publicada ? "Publicada" : "Borrador"}
                              </button>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                                {p.publicada && !p.es_landing && (
                                  <a
                                    href={`/web/o/${p.slug}`}
                                    target="_blank"
                                    onClick={e => e.stopPropagation()}
                                    style={{ display: "flex", alignItems: "center", color: "#64748b" }}
                                    title="Ver página"
                                  >
                                    <ExternalLink size={15} />
                                  </a>
                                )}
                                {!p.es_landing && (
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); setConfirmarBorrar(p.id); }}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}
                                    title="Eliminar"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      )}

      {confirmarBorrar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setConfirmarBorrar(null)}>
          <div style={{ background: "#ffffff", borderRadius: "0.75rem", padding: "1.25rem", maxWidth: "320px", width: "100%" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#1e293b", margin: "0 0 0.5rem 0" }}>¿Eliminar esta página?</p>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmarBorrar(null)} style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", border: "1px solid #cbd5e1", borderRadius: "0.4rem", background: "#ffffff", cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => borrar(confirmarBorrar)} style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", border: "none", borderRadius: "0.4rem", background: "#ef4444", color: "#ffffff", cursor: "pointer" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

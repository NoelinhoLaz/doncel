"use client";

import React, { useState, useTransition, useEffect } from "react";
import { X } from "lucide-react";
import styles from "../../page.module.css";
import type { Seccion, NegoPlanetItem, NegoPlanetAutoTipo } from "../../types";
import {
  buscarProgramasPorPaisNegoPlanet,
  listarProgramasDestacadosNegoPlanet,
  listarProgramasMasVendidosNegoPlanet,
  resolverItemsAutoNegoPlanetSesion,
} from "@/actions/negoplanet";

export default function EditorNegoPlanet({
  seccion,
  onUpdate,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const modo = seccion.negoPlanetModo ?? "fijo";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Título de la sección</label>
        <input
          type="text"
          placeholder="Ej. Nuestros destinos"
          value={seccion.titulo ?? ""}
          onChange={e => onUpdate(seccion.uid, { titulo: e.target.value })}
          className={styles.editorInput}
          style={{ width: "100%", background: "#ffffff" }}
        />
      </div>

      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Modo de la sección</label>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={() => onUpdate(seccion.uid, { negoPlanetModo: "fijo" })}
            style={{
              flex: 1, padding: "0.5rem", fontSize: "0.78rem", fontWeight: 600, borderRadius: "0.375rem", cursor: "pointer",
              border: modo === "fijo" ? "1px solid #1e293b" : "1px solid #e2e8f0",
              background: modo === "fijo" ? "#1e293b" : "#ffffff",
              color: modo === "fijo" ? "#ffffff" : "#475569",
            }}
          >
            Fijo (elegidos a mano)
          </button>
          <button
            type="button"
            onClick={() => onUpdate(seccion.uid, { negoPlanetModo: "auto" })}
            style={{
              flex: 1, padding: "0.5rem", fontSize: "0.78rem", fontWeight: 600, borderRadius: "0.375rem", cursor: "pointer",
              border: modo === "auto" ? "1px solid #1e293b" : "1px solid #e2e8f0",
              background: modo === "auto" ? "#1e293b" : "#ffffff",
              color: modo === "auto" ? "#ffffff" : "#475569",
            }}
          >
            Automático (se actualiza solo)
          </button>
        </div>
        <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "6px 0 0 0" }}>
          {modo === "fijo"
            ? "Eliges destinos/programas concretos. Si NegoPlanet los actualiza, tendrás que volver a añadirlos."
            : "Defines un criterio (ej. país o destacados) y la web consulta NegoPlanet en vivo cada vez que se carga."}
        </p>
      </div>

      {modo === "fijo" ? (
        <EditorModoFijo seccion={seccion} onUpdate={onUpdate} />
      ) : (
        <EditorModoAuto seccion={seccion} onUpdate={onUpdate} />
      )}
    </div>
  );
}

function EditorModoFijo({
  seccion,
  onUpdate,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const [query, setQuery] = useState("");
  const [tipoSinFiltro, setTipoSinFiltro] = useState<"destacado" | "mas-vendidos">("destacado");
  const [resultados, setResultados] = useState<any[]>([]);
  const [buscando, startBusqueda] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [buscado, setBuscado] = useState(false);

  const items = seccion.negoPlanetItems ?? [];

  const buscar = () => {
    const nombre = query.trim();
    setError(null);
    setBuscado(false);
    startBusqueda(async () => {
      const res = nombre
        ? await buscarProgramasPorPaisNegoPlanet(nombre)
        : tipoSinFiltro === "mas-vendidos"
        ? await listarProgramasMasVendidosNegoPlanet()
        : await listarProgramasDestacadosNegoPlanet();
      setBuscado(true);
      if (!res.ok) {
        setError(res.error || "Error al buscar en NegoPlanet");
        setResultados([]);
        return;
      }
      setResultados(res.data);
    });
  };

  const añadirItem = (r: any) => {
    const nuevo: NegoPlanetItem = {
      uid: `nego-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      origen: "programa",
      externalId: r.id,
      slug: r.post_name,
      titulo: r.post_title,
      descripcion: r.post_excerpt,
      precio: r.precio,
      dias: r.dias,
      imagen: r.imagen,
    };
    onUpdate(seccion.uid, { negoPlanetItems: [...items, nuevo] });
  };

  const quitarItem = (uid: string) => {
    onUpdate(seccion.uid, { negoPlanetItems: items.filter(i => i.uid !== uid) });
  };

  return (
    <>
      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Buscar programas en NegoPlanet</label>

        <input
          type="text"
          placeholder="Ej. Kenia, Portugal… (vacío = destacados/más vendidos)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }}
          className={styles.editorInput}
          style={{ width: "100%", background: "#ffffff", marginBottom: "6px" }}
        />

        {!query.trim() && (
          <select
            value={tipoSinFiltro}
            onChange={e => setTipoSinFiltro(e.target.value as "destacado" | "mas-vendidos")}
            className={styles.editorInput}
            style={{ width: "100%", background: "#ffffff", marginBottom: "6px" }}
          >
            <option value="destacado">Destacados</option>
            <option value="mas-vendidos">Más vendidos</option>
          </select>
        )}

        <button
          type="button"
          onClick={buscar}
          disabled={buscando}
          style={{ width: "100%", padding: "0.5rem", fontSize: "0.8rem", fontWeight: 600, color: "#ffffff", background: "#1e293b", border: "none", borderRadius: "0.375rem", cursor: "pointer", marginBottom: "6px" }}
        >
          {buscando ? "Buscando…" : query.trim() ? "Buscar" : "Traer todos"}
        </button>

        {error && <p style={{ fontSize: "0.75rem", color: "#dc2626", margin: "0 0 6px 0" }}>{error}</p>}

        {!error && buscado && resultados.length === 0 && (
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0 0 6px 0" }}>Sin resultados para esta búsqueda.</p>
        )}

        {resultados.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "220px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "6px" }}>
            {resultados.map((r, i) => (
              <button
                key={r.id ?? r.post_name ?? i}
                type="button"
                onClick={() => añadirItem(r)}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.4rem 0.5rem", border: "none", background: "#f8fafc", borderRadius: "0.375rem", cursor: "pointer", textAlign: "left" }}
              >
                {r.imagen && <div style={{ width: 32, height: 32, borderRadius: "0.25rem", backgroundImage: `url(${r.imagen})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0 }} />}
                <span style={{ fontSize: "0.8rem", color: "#1e293b" }}>{r.post_title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.editorSection}>
        <label className={styles.editorFieldLabel}>Elementos añadidos ({items.length})</label>
        {items.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>Busca y añade programas para mostrarlos en esta sección.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {items.map(item => (
              <div key={item.uid} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.4rem 0.5rem", background: "#f8fafc", borderRadius: "0.375rem" }}>
                {item.imagen && <div style={{ width: 28, height: 28, borderRadius: "0.25rem", backgroundImage: `url(${item.imagen})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0 }} />}
                <span style={{ fontSize: "0.78rem", color: "#1e293b", flex: 1 }}>{item.titulo}</span>
                <button
                  type="button"
                  onClick={() => quitarItem(item.uid)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}
                  title="Quitar"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function EditorModoAuto({
  seccion,
  onUpdate,
}: {
  seccion: Seccion;
  onUpdate: (uid: string, patch: Partial<Seccion>) => void;
}) {
  const autoTipo: NegoPlanetAutoTipo = seccion.negoPlanetAutoTipo ?? "programas-destacados";
  const autoQuery = seccion.negoPlanetAutoQuery ?? "";

  const [preview, setPreview] = useState<any[]>([]);
  const [cargando, startCarga] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    startCarga(async () => {
      const res = await resolverItemsAutoNegoPlanetSesion(autoTipo, autoQuery);
      if (!res.ok) {
        setError(res.error || "Error al consultar NegoPlanet");
        setPreview([]);
        return;
      }
      setPreview(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTipo, autoQuery]);

  return (
    <div className={styles.editorSection}>
      <label className={styles.editorFieldLabel}>Criterio automático</label>
      <select
        value={autoTipo}
        onChange={e => onUpdate(seccion.uid, { negoPlanetAutoTipo: e.target.value as NegoPlanetAutoTipo })}
        className={styles.editorInput}
        style={{ width: "100%", background: "#ffffff", marginBottom: "6px" }}
      >
        <option value="programas-destacados">Programas destacados</option>
        <option value="programas-mas-vendidos">Programas más vendidos</option>
        <option value="programas-pais">Programas de un país</option>
      </select>

      {autoTipo === "programas-pais" && (
        <input
          type="text"
          placeholder="Ej. Alemania, Kenia, Portugal…"
          value={autoQuery}
          onChange={e => onUpdate(seccion.uid, { negoPlanetAutoQuery: e.target.value })}
          className={styles.editorInput}
          style={{ width: "100%", background: "#ffffff", marginBottom: "6px" }}
        />
      )}

      <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "0 0 6px 0" }}>
        Esta sección consultará NegoPlanet en vivo cada vez que se cargue la página, mostrando siempre los datos más recientes.
      </p>

      {cargando && <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>Cargando vista previa…</p>}
      {error && <p style={{ fontSize: "0.75rem", color: "#dc2626", margin: 0 }}>{error}</p>}
      {!cargando && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "220px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "6px" }}>
          {preview.length === 0 ? (
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0, padding: "0.4rem" }}>Sin resultados para este criterio.</p>
          ) : preview.map(item => (
            <div key={item.uid} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.4rem 0.5rem" }}>
              {item.imagen && <div style={{ width: 28, height: 28, borderRadius: "0.25rem", backgroundImage: `url(${item.imagen})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0 }} />}
              <span style={{ fontSize: "0.78rem", color: "#1e293b" }}>{item.titulo}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

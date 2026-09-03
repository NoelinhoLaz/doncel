"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import styles from "./selectorDestinatarios.module.css";
import { getDestinatariosPorEntidadIds, getEmailsDeEntidad, getClientesPersona, getGruposEmpresa, getUltimasDifusionesPorEntidad, type EntidadDestinatarios } from "@/actions/difusiones";
import { getEntidadesViajerosExpediente, getEntidadTitularExpediente, getEntidadesClienteExpediente } from "@/actions/encuestas";
import { searchExpedientes } from "@/actions/expedientes";
import { AlertTriangle, ShieldCheck } from "lucide-react";

export type CategoriaKey =
  | "clientes"
  | "viajeros"
  | "contacto_principal"
  | "grupos.institucional"
  | "grupos.responsable"
  | "institucional"
  | "responsable";

export type NodoDestinatario = {
  key: CategoriaKey;
  label: string;
  children?: { key: CategoriaKey; label: string }[];
};

// Árboles reutilizables por contexto.
export const ARBOL_EXPEDIENTE: NodoDestinatario[] = [
  { key: "clientes", label: "Clientes" },
  { key: "viajeros", label: "Viajeros" },
  { key: "contacto_principal", label: "Contacto principal" },
];

export const ARBOL_GENERAL: NodoDestinatario[] = [
  { key: "clientes", label: "Clientes" },
  { key: "viajeros", label: "Viajeros" },
  {
    key: "grupos.institucional",
    label: "Grupos/Empresas",
    children: [
      { key: "grupos.institucional", label: "Institucional" },
      { key: "grupos.responsable", label: "Responsable" },
    ],
  },
];

export const ARBOL_CLIENTES: NodoDestinatario[] = [
  { key: "clientes", label: "Clientes" },
  {
    key: "grupos.institucional",
    label: "Grupos/Empresas",
    children: [
      { key: "grupos.institucional", label: "Institucional" },
      { key: "grupos.responsable", label: "Responsable" },
    ],
  },
];

export const ARBOL_CAMPANA: NodoDestinatario[] = [
  { key: "institucional", label: "Institucional" },
  { key: "responsable", label: "Responsable" },
];

type Props = {
  arbol?: NodoDestinatario[];
  expedienteId?: string;
  campanaId?: string;
  entidades: EntidadDestinatarios[];
  onEntidadesChange: React.Dispatch<React.SetStateAction<EntidadDestinatarios[]>>;
  selectedEmails: Set<string>;
  onToggleEmail: (entidadId: string, email: string) => void;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  emailKey: (entidadId: string, email: string) => string;
};

const ETIQUETA_POR_PREFIJO: Record<string, string> = {
  clientes: "Cliente",
  viajeros: "Viajero",
  contacto: "Contacto",
  grupos: "Grupo",
  campana: "Campaña",
};

function etiquetaDestinatario(entidadId: string, emailTipo: "institucional" | "contacto"): string {
  const prefijo = entidadId.includes("::") ? entidadId.split("::")[0] : "";
  if (prefijo === "grupos" || prefijo === "campana") {
    return emailTipo === "institucional" ? "Institucional" : "Responsable";
  }
  return ETIQUETA_POR_PREFIJO[prefijo] ?? "";
}

function diasDesde(isoFecha: string) {
  const diff = Date.now() - new Date(isoFecha).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function SelectorDestinatarios({
  arbol = ARBOL_GENERAL,
  expedienteId,
  campanaId,
  entidades,
  onEntidadesChange,
  selectedEmails,
  onToggleEmail,
  loading,
  onLoadingChange,
  emailKey,
}: Props) {
  const [vistaActiva, setVistaActiva] = useState<CategoriaKey | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [ultimosEnvios, setUltimosEnvios] = useState<Record<string, { fecha: string; asunto: string }>>({});
  const [excluirRecientes, setExcluirRecientes] = useState(false);

  const [expedienteFiltro, setExpedienteFiltro] = useState<{ id: string; nombre: string } | null>(null);
  const [expQuery, setExpQuery] = useState("");
  const [expResultados, setExpResultados] = useState<{ id: string; nombre: string }[]>([]);
  const debounceExpRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const necesitaExpediente = !expedienteId && (vistaActiva === "clientes" || vistaActiva === "viajeros");

  useEffect(() => {
    const rawIds = entidades
      .map((e) => (e.entidad_id.includes("::") ? e.entidad_id.split("::")[1] : e.entidad_id))
      .filter(Boolean);
    const uniqueIds = Array.from(new Set(rawIds));
    if (uniqueIds.length > 0) {
      getUltimasDifusionesPorEntidad(uniqueIds)
        .then((mapa) => setUltimosEnvios((prev) => ({ ...prev, ...mapa })))
        .catch(() => {});
    }
  }, [entidades]);

  useEffect(() => {
    if (!expQuery.trim()) { setExpResultados([]); return; }
    if (debounceExpRef.current) clearTimeout(debounceExpRef.current);
    debounceExpRef.current = setTimeout(async () => {
      const res = await searchExpedientes(expQuery);
      setExpResultados(res.success ? res.data : []);
    }, 300);
  }, [expQuery]);

  function agregarEntidades(nuevas: EntidadDestinatarios[], prefijo: string) {
    onEntidadesChange((prev) => [...prev.filter((e) => !e.entidad_id.startsWith(prefijo)), ...nuevas]);
  }

  async function resolverCategoria(cat: CategoriaKey) {
    onLoadingChange(true);
    try {
      if (cat === "clientes") {
        if (expedienteId) {
          const ids = await getEntidadesClienteExpediente(expedienteId);
          const data = await getDestinatariosPorEntidadIds(ids);
          agregarEntidades(data.map((e) => ({ ...e, entidad_id: `clientes::${e.entidad_id}` })), "clientes::");
        } else if (expedienteFiltro) {
          const ids = await getEntidadesClienteExpediente(expedienteFiltro.id);
          const data = await getDestinatariosPorEntidadIds(ids);
          agregarEntidades(data.map((e) => ({ ...e, entidad_id: `clientes::${e.entidad_id}` })), "clientes::");
        } else {
          const data = await getClientesPersona();
          agregarEntidades(data.map((e) => ({ ...e, entidad_id: `clientes::${e.entidad_id}` })), "clientes::");
        }
      } else if (cat === "viajeros") {
        const expId = expedienteId ?? expedienteFiltro?.id;
        if (!expId) { agregarEntidades([], "viajeros::"); return; }
        const ids = await getEntidadesViajerosExpediente(expId);
        const data = await getDestinatariosPorEntidadIds(ids);
        agregarEntidades(data.map((e) => ({ ...e, entidad_id: `viajeros::${e.entidad_id}` })), "viajeros::");
      } else if (cat === "contacto_principal") {
        if (!expedienteId) { agregarEntidades([], "contacto::"); return; }
        const id = await getEntidadTitularExpediente(expedienteId);
        if (!id) { agregarEntidades([], "contacto::"); return; }
        const data = await getEmailsDeEntidad(id);
        const soloContactos = data ? [{ ...data, emails: data.emails.filter((e) => e.tipo === "contacto") }] : [];
        agregarEntidades(
          soloContactos.filter((e) => e.emails.length > 0).map((e) => ({ ...e, entidad_id: `contacto::${e.entidad_id}` })),
          "contacto::"
        );
      } else if (cat === "grupos.institucional" || cat === "grupos.responsable") {
        const data = await getGruposEmpresa();
        const tipoIncluido = cat === "grupos.institucional" ? "institucional" : "contacto";
        const filtradas = data
          .map((e) => ({ ...e, emails: e.emails.filter((em) => em.tipo === tipoIncluido) }))
          .filter((e) => e.emails.length > 0);
        agregarEntidades(filtradas.map((e) => ({ ...e, entidad_id: `grupos::${e.entidad_id}` })), "grupos::");
      } else if (cat === "institucional" || cat === "responsable") {
        if (!campanaId) { agregarEntidades([], "campana::"); return; }
        const { getDestinatariosPorCampana } = await import("@/actions/difusiones");
        const data = await getDestinatariosPorCampana(campanaId);
        const tipoIncluido = cat === "institucional" ? "institucional" : "contacto";
        const filtradas = data
          .map((e) => ({ ...e, emails: e.emails.filter((em) => em.tipo === tipoIncluido) }))
          .filter((e) => e.emails.length > 0);
        agregarEntidades(filtradas.map((e) => ({ ...e, entidad_id: `campana::${e.entidad_id}` })), "campana::");
      }
    } finally {
      onLoadingChange(false);
    }
  }

  function seleccionarVista(key: CategoriaKey) {
    setVistaActiva((prev) => (prev === key ? null : key));
    setBusqueda("");
  }

  useEffect(() => {
    if (vistaActiva) resolverCategoria(vistaActiva);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaActiva, expedienteFiltro]);

  const ORDEN_ETIQUETA = ["Contacto", "Cliente", "Viajero", "Institucional", "Responsable", "Manual"];

  const PREFIJO_POR_CATEGORIA: Record<CategoriaKey, string> = {
    clientes: "clientes::",
    viajeros: "viajeros::",
    contacto_principal: "contacto::",
    "grupos.institucional": "grupos::",
    "grupos.responsable": "grupos::",
    institucional: "campana::",
    responsable: "campana::",
  };

  const opcionesPill: { key: CategoriaKey; label: string }[] = arbol.flatMap((n) => (n.children ? n.children : [n]));

  function filasDeCategoria(cat: CategoriaKey) {
    const prefijo = PREFIJO_POR_CATEGORIA[cat];
    const tipoRequerido =
      cat === "grupos.responsable" || cat === "responsable" ? "contacto" : cat === "grupos.institucional" || cat === "institucional" ? "institucional" : null;
    const porEmail = new Map<string, { entidadId: string; realId: string; nombre: string; email: string; etiqueta: string }>();
    for (const ent of entidades) {
      if (!ent.entidad_id.startsWith(prefijo)) continue;
      const realId = ent.entidad_id.includes("::") ? ent.entidad_id.split("::")[1] : ent.entidad_id;
      for (const em of ent.emails) {
        if (tipoRequerido && em.tipo !== tipoRequerido) continue;
        const key = em.email.trim().toLowerCase();
        const etiqueta = etiquetaDestinatario(ent.entidad_id, em.tipo);
        const existente = porEmail.get(key);
        if (!existente || ORDEN_ETIQUETA.indexOf(etiqueta) < ORDEN_ETIQUETA.indexOf(existente.etiqueta)) {
          porEmail.set(key, { entidadId: ent.entidad_id, realId, nombre: ent.nombre, email: em.email, etiqueta });
        }
      }
    }
    return [...porEmail.values()];
  }

  function contarSeleccionados(cat: CategoriaKey) {
    return filasDeCategoria(cat).filter((f) => selectedEmails.has(emailKey(f.entidadId, f.email))).length;
  }

  const filasVista = vistaActiva ? filasDeCategoria(vistaActiva) : [];

  const filasFiltradas = useMemo(() => {
    return filasVista.filter((f) => {
      if (excluirRecientes) {
        const info = ultimosEnvios[f.realId];
        if (info && diasDesde(info.fecha) < 7) return false;
      }
      if (!busqueda.trim()) return true;
      const q = busqueda.toLowerCase();
      return f.nombre.toLowerCase().includes(q) || f.email.toLowerCase().includes(q);
    });
  }, [filasVista, busqueda, excluirRecientes, ultimosEnvios]);

  const totalVista = filasVista.length;
  const seleccionadosVista = filasVista.filter((f) => selectedEmails.has(emailKey(f.entidadId, f.email))).length;

  return (
    <div className={styles.wrapper}>
      <div className={styles.chipsRow}>
        {opcionesPill.map((op) => {
          const n = contarSeleccionados(op.key);
          return (
            <button
              key={op.key}
              type="button"
              className={`${styles.chip} ${vistaActiva === op.key ? styles.chipActive : ""}`}
              onClick={() => seleccionarVista(op.key)}
            >
              {op.label}
              {n > 0 && <span className={styles.chipCount}>{n}</span>}
            </button>
          );
        })}
      </div>

      {necesitaExpediente && (
        <div className={styles.field}>
          <label className={styles.label}>Expediente</label>
          <input
            className={styles.input}
            value={expedienteFiltro ? expedienteFiltro.nombre : expQuery}
            onChange={(e) => { setExpQuery(e.target.value); setExpedienteFiltro(null); }}
            placeholder="Buscar expediente..."
          />
          {expResultados.length > 0 && (
            <div className={styles.searchResults}>
              {expResultados.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={styles.searchResultItem}
                  onClick={() => { setExpedienteFiltro(r); setExpQuery(r.nombre); setExpResultados([]); }}
                >
                  {r.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {vistaActiva && !loading && filasVista.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            className={styles.input}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en esta lista..."
            style={{ flex: 1, minWidth: 200 }}
          />
          <button
            type="button"
            onClick={() => setExcluirRecientes((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "0.45rem 0.65rem",
              borderRadius: 8,
              border: "1px solid",
              borderColor: excluirRecientes ? "#f59e0b" : "#e2e8f0",
              background: excluirRecientes ? "#fef3c7" : "#fff",
              color: excluirRecientes ? "#b45309" : "#475569",
              fontSize: "0.74rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Protege a clientes contactados en los últimos 7 días"
          >
            <ShieldCheck size={13} />
            {excluirRecientes ? "Excluyendo < 7 días" : "Excluir contactados < 7 días"}
          </button>
        </div>
      )}

      {vistaActiva && (
        <div className={styles.selectAllRow}>
          <span className={styles.countLabel}>
            {loading ? "Cargando…" : `${seleccionadosVista} de ${totalVista} seleccionados`}
          </span>
          {!loading && totalVista > 0 && (
            <button
              type="button"
              className={styles.selectAllBtn}
              onClick={() => {
                const todosMarcados = filasFiltradas.every((f) => selectedEmails.has(emailKey(f.entidadId, f.email)));
                filasFiltradas.forEach((f) => {
                  const yaMarcado = selectedEmails.has(emailKey(f.entidadId, f.email));
                  if (todosMarcados && yaMarcado) onToggleEmail(f.entidadId, f.email);
                  else if (!todosMarcados && !yaMarcado) onToggleEmail(f.entidadId, f.email);
                });
              }}
            >
              {filasFiltradas.every((f) => selectedEmails.has(emailKey(f.entidadId, f.email))) ? "Deseleccionar mostrados" : "Seleccionar mostrados"}
            </button>
          )}
        </div>
      )}

      {!vistaActiva ? (
        <p className={styles.hint}>Elige una categoría para ver y marcar sus destinatarios.</p>
      ) : loading ? (
        <p className={styles.hint} style={{ textAlign: "center", padding: "1rem 0" }}>Cargando destinatarios…</p>
      ) : filasVista.length === 0 ? (
        <p className={styles.hint}>No se han encontrado destinatarios con email para esta selección.</p>
      ) : filasFiltradas.length === 0 ? (
        <p className={styles.hint}>Sin resultados para "{busqueda}".</p>
      ) : (
        <div className={styles.entidadesGrid}>
          {filasFiltradas.map((fila) => {
            const envioPrevio = ultimosEnvios[fila.realId];
            const dias = envioPrevio ? diasDesde(envioPrevio.fecha) : null;
            const esReciente = dias !== null && dias < 7;

            return (
              <label key={emailKey(fila.entidadId, fila.email)} className={styles.destinatarioRow}>
                <input
                  type="checkbox"
                  checked={selectedEmails.has(emailKey(fila.entidadId, fila.email))}
                  onChange={() => onToggleEmail(fila.entidadId, fila.email)}
                />
                <span className={styles.destinatarioLinea}>{fila.nombre} — {fila.email}</span>
                {fila.etiqueta && <span className={`${styles.tipoTag} ${styles["tipoTag_" + fila.etiqueta]}`}>{fila.etiqueta}</span>}
                {esReciente && (
                  <span
                    title={`Recibió: "${envioPrevio?.asunto}" el ${new Date(envioPrevio!.fecha).toLocaleDateString("es-ES")}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      color: "#b45309",
                      background: "#fef3c7",
                      padding: "0.1rem 0.45rem",
                      borderRadius: 4,
                      marginLeft: 4,
                    }}
                  >
                    <AlertTriangle size={10} /> Enviado hace {dias === 0 ? "hoy" : dias === 1 ? "1d" : `${dias}d`}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

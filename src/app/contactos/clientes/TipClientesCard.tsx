"use client";

import { useEffect, useState } from "react";
import { X, UserX, PhoneOff, MailX, Tags, MapPin, Tag, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "../page.module.css";

type Tip = {
  id: string;
  titulo: string;
  mensaje: string;
  filtro: { tipo: "email_ausente" | "telefono_ausente" | "etiqueta_ausente" | "localidad" | "localidad_ausente" | "etiqueta" | "inactivo_2_3" | "inactivo_5_mas"; valor?: string } | null;
  accionLabel: string | null;
};

const ICONO_POR_TIPO: Record<string, LucideIcon> = {
  inactivos_2_3: UserX,
  inactivos_5_mas: UserX,
  sin_email: MailX,
  sin_telefono: PhoneOff,
  sin_etiqueta: Tags,
  sin_localidad: MapPin,
  concentracion_geografica: MapPin,
  etiqueta_dominante: Tag,
};

function TipCard({
  tip,
  onAplicarFiltro,
}: {
  tip: Tip;
  onAplicarFiltro: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icono = ICONO_POR_TIPO[tip.id] ?? Lightbulb;

  const MAX_CHARS = 110; // aprox. lo que cabe en 2 líneas dentro de la tarjeta
  const truncated = tip.mensaje.length > MAX_CHARS;
  const textoCorto = truncated ? tip.mensaje.slice(0, MAX_CHARS).replace(/\s+\S*$/, "") : tip.mensaje;

  return (
    <div className={styles.tipCard} style={{ flex: 1, minWidth: 0, flexDirection: "column", alignItems: "stretch", gap: "0.35rem", position: "relative", overflow: "hidden" }}>
      <Icono size={72} className={styles.tipIconWatermark} />

      <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, color: "color-mix(in srgb, var(--primary-color, #475569) 90%, black)", position: "relative" }}>
        {tip.titulo}
      </p>

      <div className={styles.tipText} style={{ margin: 0, position: "relative" }}>
        <p style={{ margin: 0 }}>
          {expanded ? tip.mensaje : textoCorto}
          {truncated && (
            <button
              type="button"
              className={styles.tipMoreBtn}
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              style={{ marginLeft: "0.25rem" }}
            >
              {expanded ? "Mostrar menos" : "(más..)"}
            </button>
          )}
        </p>
      </div>

      {tip.accionLabel && tip.filtro && (
        <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
          <button type="button" className={styles.tipActionBtn} onClick={onAplicarFiltro}>
            {tip.accionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TipClientesCard({
  onAplicarFiltro,
}: {
  onAplicarFiltro: (filtro: Tip["filtro"], agenteId: string | null) => void;
}) {
  const [tips, setTips] = useState<Tip[]>([]);
  const [agenteId, setAgenteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [descartados, setDescartados] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/contactos/clientes/tip")
      .then((r) => r.json())
      .then((j) => { if (j?.success) { setTips(j.tips ?? []); setAgenteId(j.agenteId ?? null); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const visibles = tips.filter((t) => !descartados.has(t.id));

  if (loading || visibles.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", background: "#fff", borderRadius: "16px", padding: "1rem 1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "1rem", fontWeight: 700, color: "#334155" }}>
          <img src="/alivia_icon_on.png" alt="Alivia" style={{ width: 17, height: 17 }} />
          Consejos del Copiloto Alivia
        </span>
        <button
          type="button"
          onClick={() => setDescartados(new Set(tips.map((t) => t.id)))}
          className={styles.tipNavBtn}
          title="Cerrar todos"
        >
          <X size={13} />
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", width: "100%" }}>
        {visibles.map((tip) => (
          <TipCard
            key={tip.id}
            tip={tip}
            onAplicarFiltro={() => onAplicarFiltro(tip.filtro, agenteId)}
          />
        ))}
      </div>
    </div>
  );
}

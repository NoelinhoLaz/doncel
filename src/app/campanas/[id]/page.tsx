"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar } from "lucide-react";
import styles from "./page.module.css";
import NuevoPresupuestoModal from "@/app/presupuestos/NuevoPresupuestoModal";
import { ModalPlacesNearby } from "./ModalPlacesNearby";

import type { Campana, Oportunidad, EntidadDetalle } from "./types";
import { apiFetch, formatFecha } from "./utils";
import { NuevaOportunidadModal } from "./modals/NuevaOportunidadModal";
import { ModalCierreOportunidad } from "./modals/ModalCierreOportunidad";
import { PanelEntidad } from "./panels/PanelEntidad";
import { TablaOportunidades } from "./table/TablaOportunidades";

export default function CampanaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campana, setCampana] = useState<Campana | null>(null);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPlacesNearby, setShowPlacesNearby] = useState(false);
  const [monocromo, setMonocromo] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [currentAgenteId, setCurrentAgenteId] = useState<string | null>(null);
  const [entidadPanel, setEntidadPanel] = useState<EntidadDetalle | null>(null);

  const [pendingClosure, setPendingClosure] = useState<{
    oportunidadId: string;
    estadoId: string;
  } | null>(null);
  const [savingClosure, setSavingClosure] = useState(false);

  const [presupuestoModal, setPresupuestoModal] = useState<{
    oportunidadId: string;
    campanaId: string;
    oportunidadNombre: string;
    presupuesto: any | null;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, { data: ops }] = await Promise.all([
        apiFetch(`/api/crm/campanas/${id}`),
        apiFetch(`/api/crm/oportunidades?campana_id=${id}`),
      ]);
      const owner = ["Owner", "SuperAdmin", "Admin"].includes(campRes.rol ?? "");
      setCampana(campRes.data);
      setIsOwner(owner);
      setCurrentAgenteId(campRes.agenteId ?? null);
      const allOps: Oportunidad[] = ops ?? [];
      setOportunidades(owner ? allOps : allOps.filter(o => o.agente_id === campRes.agenteId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function executeEstadoChange(oportunidadId: string, estadoId: string, closureData?: any) {
    const notas = closureData ? JSON.stringify(closureData) : undefined;

    if (closureData) {
      try {
        await apiFetch(`/api/crm/oportunidades/${oportunidadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prioridad: closureData.prioridad ?? null,
            valor_estimado: closureData.valorEstimado,
          }),
        });
      } catch (e) {
        console.error("Error al actualizar prioridad/valor:", e);
      }
    }

    setOportunidades(prev => prev.map(o => o.id === oportunidadId ? {
      ...o,
      estado_id: estadoId,
      ultima_nota_log: notas ?? o.ultima_nota_log,
      ...(closureData ? { prioridad: closureData.prioridad ?? null, valor_estimado: closureData.valorEstimado } : {}),
    } : o));

    try {
      await apiFetch(`/api/crm/oportunidades/${oportunidadId}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_id: estadoId, notas }),
      });
    } catch (e) {
      console.error(e);
      loadData();
    }
  }

  async function handleEliminarOportunidad(oportunidadId: string) {
    setOportunidades(prev => prev.filter(o => o.id !== oportunidadId));
    try {
      await apiFetch(`/api/crm/oportunidades/${oportunidadId}`, { method: "DELETE" });
    } catch (e) {
      console.error(e);
      loadData();
    }
  }

  async function handleAgenteChange(oportunidadId: string, agenteId: string | null) {
    const agEntry = campana?.crm_campanas_agentes?.find(a => a.agente_id === agenteId);
    const ag = agEntry?.crm_agentes ?? null;
    setOportunidades(prev => prev.map(o => o.id !== oportunidadId ? o : {
      ...o,
      agente_id: agenteId,
      crm_agentes: ag ? { id: ag.id, nombre: ag.nombre, apellidos: ag.apellidos, avatar_url: ag.avatar_url } : null,
    }));
    try {
      await apiFetch(`/api/crm/oportunidades/${oportunidadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agente_id: agenteId }),
      });
    } catch (e) {
      console.error("Error al cambiar agente:", e);
      loadData();
    }
  }

  async function abrirPresupuestoParaOportunidad(oportunidadId: string) {
    const op = oportunidades.find(o => o.id === oportunidadId);
    const nombre = op?.contabilidad_entidades?.nombre || op?.titulo || oportunidadId;
    try {
      const res = await fetch(`/api/presupuestos?oportunidad_id=${oportunidadId}`);
      const json = await res.json();
      const existente = json?.data?.[0] ?? null;
      setPresupuestoModal({ oportunidadId, campanaId: id, oportunidadNombre: nombre, presupuesto: existente });
    } catch {
      setPresupuestoModal({ oportunidadId, campanaId: id, oportunidadNombre: nombre, presupuesto: null });
    }
  }

  async function handleEstadoChange(oportunidadId: string, estadoId: string) {
    const targetEstado = campana?.crm_campanas_estados?.find(e => e.id === estadoId);
    const isClosureState = targetEstado?.es_final && !targetEstado?.es_ganado;

    if (isClosureState) {
      setPendingClosure({ oportunidadId, estadoId });
      return;
    }

    if (targetEstado?.nombre?.toLowerCase() === "visitando") {
      await executeEstadoChange(oportunidadId, estadoId);
      await abrirPresupuestoParaOportunidad(oportunidadId);
      return;
    }

    await executeEstadoChange(oportunidadId, estadoId);
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "2rem" }}>Cargando campaña…</p>
      </div>
    );
  }

  if (!campana) {
    return (
      <div className={styles.container}>
        <p style={{ color: "#dc2626", fontSize: "0.85rem", padding: "2rem" }}>Campaña no encontrada.</p>
      </div>
    );
  }

  const estados = campana.crm_campanas_estados ?? [];

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} onClick={() => router.push("/campanas")}>
          <ArrowLeft size={14} />
        </button>
        <div className={styles.headerInfo}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 className={styles.title}>{campana.nombre}</h1>
          </div>
          <div className={styles.headerMeta}>
            {campana.fecha_inicio && <span><Calendar size={11} /> {formatFecha(campana.fecha_inicio)}</span>}
            {campana.fecha_fin && <span>→ {formatFecha(campana.fecha_fin)}</span>}
          </div>
        </div>
        <button className={styles.monoSwitch} onClick={() => setMonocromo(v => !v)} title={monocromo ? "Color" : "Monocromo"}>
          {monocromo ? (
            <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
              <circle cx="13" cy="13" r="12" fill="color-mix(in srgb, var(--primary-color, #475569) 20%, white)" stroke="color-mix(in srgb, var(--primary-color, #475569) 40%, white)" strokeWidth="1"/>
              <path d="M13 1 A12 12 0 0 1 13 25 Z" fill="color-mix(in srgb, var(--primary-color, #475569) 60%, white)"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
              <circle cx="13" cy="13" r="12" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
              {[{color:"#ef4444",r:0},{color:"#f97316",r:60},{color:"#eab308",r:120},{color:"#22c55e",r:180},{color:"#3b82f6",r:240},{color:"#a855f7",r:300}].map(({color,r},i)=>{
                const s=(r-30)*Math.PI/180,en=(r+30)*Math.PI/180;
                return <path key={i} d={`M13,13 L${(13+12*Math.cos(s)).toFixed(2)},${(13+12*Math.sin(s)).toFixed(2)} A12,12 0 0,1 ${(13+12*Math.cos(en)).toFixed(2)},${(13+12*Math.sin(en)).toFixed(2)} Z`} fill={color}/>;
              })}
              <circle cx="13" cy="13" r="5" fill="white"/>
            </svg>
          )}
        </button>
      </div>

      <TablaOportunidades
        oportunidades={oportunidades}
        estados={estados}
        monocromo={monocromo}
        isOwner={isOwner}
        campanaId={campana.id}
        objetivoTotal={campana.crm_campanas_agentes?.reduce((s, a) => s + (a.objetivo_valor ?? 0), 0) ?? 0}
        agentes={campana.crm_campanas_agentes ?? []}
        onNuevaOportunidad={() => setShowModal(true)}
        onNuevaOportunidadPlaces={() => setShowPlacesNearby(true)}
        onEstadoChange={handleEstadoChange}
        onPresupuestoClick={abrirPresupuestoParaOportunidad}
        onCierreClick={(oportunidadId, estadoId) => setPendingClosure({ oportunidadId, estadoId })}
        onAgenteChange={handleAgenteChange}
        onEliminarOportunidad={handleEliminarOportunidad}
        onEntidadClick={e => setEntidadPanel(e)}
        onOportunidadUpdate={(id, patch) => setOportunidades(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o))}
      />

      {showModal && campana && (
        <NuevaOportunidadModal
          campanaId={campana.id}
          estados={estados}
          onClose={() => setShowModal(false)}
          onCreated={loadData}
        />
      )}

      {showPlacesNearby && campana && (
        <ModalPlacesNearby
          campanaId={campana.id}
          estados={estados}
          onClose={() => setShowPlacesNearby(false)}
          onCreated={loadData}
        />
      )}

      {presupuestoModal && (
        <NuevoPresupuestoModal
          oportunidadId={presupuestoModal.oportunidadId}
          oportunidadNombre={presupuestoModal.oportunidadNombre}
          campanaId={presupuestoModal.campanaId}
          presupuesto={presupuestoModal.presupuesto}
          onClose={() => setPresupuestoModal(null)}
          onCreated={() => setPresupuestoModal(null)}
        />
      )}

      {entidadPanel && (
        <PanelEntidad
          data={entidadPanel}
          onClose={() => setEntidadPanel(null)}
          onEntidadUpdated={(entidadActualizada) => {
            setEntidadPanel(p => p ? { ...p, entidad: entidadActualizada } : p);
            setOportunidades(prev => prev.map(o =>
              o.contabilidad_entidades?.id === entidadActualizada.id
                ? { ...o, contabilidad_entidades: entidadActualizada }
                : o
            ));
          }}
        />
      )}

      {pendingClosure && (
        <ModalCierreOportunidad
          onClose={() => setPendingClosure(null)}
          saving={savingClosure}
          oportunidad={(() => {
            const op = oportunidades.find(o => o.id === pendingClosure.oportunidadId);
            return op ? {
              nombre_centro: op.titulo,
              valor_estimado: op.valor_estimado,
              prioridad: op.prioridad,
              destino_interesado: op.descripcion ?? undefined,
              mig_notas: op.mig_notas ?? undefined,
              notas_agente: op.ultima_nota_log ?? undefined,
            } : undefined;
          })()}
          onSave={async (data) => {
            setSavingClosure(true);
            try {
              await executeEstadoChange(pendingClosure.oportunidadId, pendingClosure.estadoId, data);
              await loadData();
            } catch (err) {
              console.error(err);
            } finally {
              setSavingClosure(false);
              setPendingClosure(null);
            }
          }}
        />
      )}
    </div>
  );
}

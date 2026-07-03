"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import NuevoPresupuestoModal from "../NuevoPresupuestoModal";
import ExpedienteActionsToolbar from "@/app/components/ExpedienteActionsToolbar";

export default function NuevoPresupuestoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [presupuesto, setPresupuesto] = useState<any>(null);
  const [loading, setLoading] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    fetch("/api/presupuestos")
      .then(r => r.json())
      .then(j => {
        if (j?.success) {
          const found = (j.data ?? []).find((p: any) => p.id === editId);
          if (found) setPresupuesto(found);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [editId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
        Cargando…
      </div>
    );
  }

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      <div style={{ padding: "1.25rem 1.5rem 0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          onClick={() => router.push("/presupuestos")}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            color: "var(--primary-color, #475569)", fontSize: "0.82rem", fontWeight: 500,
            background: "color-mix(in srgb, var(--primary-color, #475569) 8%, white)",
            border: "1px solid color-mix(in srgb, var(--primary-color, #475569) 20%, white)",
            borderRadius: "0.5rem", padding: "0.35rem 0.75rem", cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Volver a Presupuestos
        </button>
        {editId && <ExpedienteActionsToolbar presupuestoId={editId} />}
      </div>
      <NuevoPresupuestoModal
        pageMode
        presupuesto={presupuesto ?? undefined}
        onClose={() => router.push("/presupuestos")}
        onCreated={() => router.push("/presupuestos")}
      />
    </div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import NuevoPresupuestoModal from "../NuevoPresupuestoModal";
import ExpedienteActionsToolbar from "@/app/components/ExpedienteActionsToolbar";
import { Icons } from "@/lib/icons";
import listStyles from "../../expedientes/page.module.css";

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
      <header className={listStyles.header} style={{ padding: "1.25rem 1.5rem 0.75rem" }}>
        <div className={listStyles.headerRow}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={() => router.push("/presupuestos")}
              title="Volver a Presupuestos"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#64748b", background: "none", border: "none",
                padding: "0.25rem", marginLeft: "-0.25rem", borderRadius: "0.4rem", cursor: "pointer",
              }}
            >
              <Icons.ChevronRight size={24} style={{ transform: "rotate(180deg)" }} />
            </button>
            <h1 className={listStyles.title}>
              {presupuesto ? "Editar solicitud de presupuesto" : "Nueva solicitud de presupuesto"}
            </h1>
          </div>
          {editId && <ExpedienteActionsToolbar presupuestoId={editId} />}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem" }}>
          <div id="presupuesto-header-actions" />
        </div>
      </header>
      <NuevoPresupuestoModal
        pageMode
        presupuesto={presupuesto ?? undefined}
        onClose={() => router.push("/presupuestos")}
        onCreated={() => router.push("/presupuestos")}
      />
    </div>
  );
}

"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import NuevoPresupuestoModal from "../../NuevoPresupuestoModal";

export default function PresupuestoDetallePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [presupuesto, setPresupuesto] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/presupuestos/${id}`)
      .then(r => r.json())
      .then(j => {
        if (j?.success && j.data) setPresupuesto(j.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #f8fafc 0%, color-mix(in srgb, var(--primary-color, #475569) 5%, white) 100%)",
      }}>
        <div style={{ fontSize: "0.9rem", color: "#64748b" }}>Cargando...</div>
      </div>
    );
  }

  return (
    <NuevoPresupuestoModal
      pageMode
      presupuesto={presupuesto}
      onClose={() => router.push("/presupuestos")}
      onCreated={() => router.push("/presupuestos")}
    />
  );
}

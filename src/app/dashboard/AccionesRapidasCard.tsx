"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Calculator, Presentation, Target, Heart } from "lucide-react";
import styles from "./page.module.css";
import { NuevoClientePanel } from "@/components/modals/NuevoClientePanel";

export default function AccionesRapidasCard() {
  const [nuevoClienteOpen, setNuevoClienteOpen] = useState(false);
  const [creandoCotizacion, setCreandoCotizacion] = useState(false);
  const router = useRouter();

  const crearCotizacion = async () => {
    if (creandoCotizacion) return;
    setCreandoCotizacion(true);
    try {
      const res = await fetch("/api/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: "Cotización" }),
      });
      const j = await res.json();
      if (j?.success && j.data?.id) {
        router.push(`/cotizaciones/nueva?id=${j.data.id}`);
      } else {
        alert("Error al crear cotización: " + (j?.error || "unknown"));
        setCreandoCotizacion(false);
      }
    } catch (err: any) {
      alert("Error al crear cotización: " + (err?.message || String(err)));
      setCreandoCotizacion(false);
    }
  };

  return (
    <>
      <div className={styles.accionesRapidasGrid}>
        <button className={styles.accionRapidaCard} onClick={() => setNuevoClienteOpen(true)}>
          <div className={styles.accionRapidaIcon}>
            <UserPlus size={18} />
          </div>
          <span className={styles.accionRapidaLabel}>Nuevo cliente</span>
        </button>

        <button className={styles.accionRapidaCard} onClick={crearCotizacion} disabled={creandoCotizacion}>
          <div className={styles.accionRapidaIcon}>
            <Calculator size={18} />
          </div>
          <span className={styles.accionRapidaLabel}>Nueva cotización</span>
        </button>

        <button className={styles.accionRapidaCard} onClick={() => router.push("/propuestas/nueva")}>
          <div className={styles.accionRapidaIcon}>
            <Presentation size={18} />
          </div>
          <span className={styles.accionRapidaLabel}>Nueva propuesta</span>
        </button>

        <button className={styles.accionRapidaCard} onClick={() => router.push("/campanas")}>
          <div className={styles.accionRapidaIcon}>
            <Target size={18} />
          </div>
          <span className={styles.accionRapidaLabel}>Crear campaña</span>
        </button>

        <button className={styles.accionRapidaCard} onClick={() => router.push("/comunicaciones")}>
          <div className={styles.accionRapidaIcon}>
            <Heart size={18} />
          </div>
          <span className={styles.accionRapidaLabel}>Crear comunicación</span>
        </button>
      </div>

      {nuevoClienteOpen && (
        <NuevoClientePanel
          onClose={() => setNuevoClienteOpen(false)}
          onCreated={(cliente) => {
            setNuevoClienteOpen(false);
            router.push(`/contactos/clientes?clienteId=${cliente.id}`);
          }}
        />
      )}
    </>
  );
}

"use client";

import styles from "./MenuPrincipal.module.css";
import { useRouter, usePathname } from "next/navigation";
import { Icons } from "@/lib/icons";
import { Sparkles } from "lucide-react";
import { useState } from "react";

interface Props {
  onOpenCopiloto?: () => void;
}

export default function MenuPrincipal({ onOpenCopiloto }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [expSubOpen, setExpSubOpen] = useState(false);
  const [presupSubOpen, setPresupSubOpen] = useState(false);
  const [bancoSubOpen, setBancoSubOpen] = useState(false);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <aside className={styles.menu}>
      <button 
        className={`${styles.menuItem} ${isActive("/dashboard") ? styles.active : ""}`} 
        onClick={() => router.push("/dashboard")} 
        title="Home"
      >
        <Icons.Home size={20} strokeWidth={isActive("/dashboard") ? 3 : 2} />
      </button>
 
      <button
        className={`${styles.menuItem} ${isActive("/campanas") || isActive("/oportunidades") ? styles.active : ""}`}
        title="Campañas"
        onClick={() => router.push("/campanas")}
      >
        <Icons.Target size={20} strokeWidth={isActive("/campanas") || isActive("/oportunidades") ? 3 : 2} />
      </button>

      <button
        className={`${styles.menuItem} ${isActive("/users") ? styles.active : ""}`}
        onClick={() => router.push("/users")}
        title="Usuarios"
      >
        <Icons.Users size={20} strokeWidth={isActive("/users") ? 3 : 2} />
      </button>
 
      <div
        className={styles.menuItemWrapper}
        onMouseEnter={() => setPresupSubOpen(true)}
        onMouseLeave={() => setPresupSubOpen(false)}
      >
        <button
          className={`${styles.menuItem} ${isActive("/presupuestos") || isActive("/cotizaciones") || isActive("/propuestas") ? styles.active : ""}`}
          onClick={() => router.push("/presupuestos")}
          title="Presupuestos"
        >
          <Icons.Presupuestos size={20} strokeWidth={isActive("/presupuestos") || isActive("/cotizaciones") ? 3 : 2} />
        </button>

        {presupSubOpen && (
          <div className={styles.submenuFlyout}>
            <button
              className={styles.submenuItem}
              onClick={() => { setPresupSubOpen(false); router.push("/presupuestos"); }}
            >
              <Icons.Document size={14} className={styles.submenuIcon} />
              <span>Solicitudes</span>
            </button>
            <button
              className={styles.submenuItem}
              onClick={() => { setPresupSubOpen(false); router.push("/cotizaciones"); }}
            >
              <Icons.Facturacion size={14} className={styles.submenuIcon} />
              <span>Cotizaciones</span>
            </button>
            <button
              className={styles.submenuItem}
              onClick={() => { setPresupSubOpen(false); router.push("/propuestas"); }}
            >
              <Icons.Propuestas size={14} className={styles.submenuIcon} />
              <span>Propuestas</span>
            </button>
          </div>
        )}
      </div>

      <div
        className={styles.menuItemWrapper}
        onMouseEnter={() => setExpSubOpen(true)}
        onMouseLeave={() => setExpSubOpen(false)}
      >
        <button
          className={`${styles.menuItem} ${isActive("/expedientes") ? styles.active : ""}`}
          onClick={() => router.push("/expedientes")}
          title="Expedientes"
        >
          <Icons.Expedientes size={20} strokeWidth={isActive("/expedientes") ? 3 : 2} />
        </button>

        {expSubOpen && (
          <div className={styles.submenuFlyout}>
            <button
              className={styles.submenuItem}
              onClick={() => {
                setExpSubOpen(false);
                router.push("/expedientes");
              }}
            >
              <Icons.List size={14} className={styles.submenuIcon} />
              <span>Listado</span>
            </button>
            <button
              className={styles.submenuItem}
              onClick={() => {
                setExpSubOpen(false);
                router.push("/expedientes/reservas");
              }}
            >
              <Icons.Calendar size={14} className={styles.submenuIcon} />
              <span>Reservas Unificadas</span>
            </button>
          </div>
        )}
      </div>

      <div
        className={styles.menuItemWrapper}
        onMouseEnter={() => setBancoSubOpen(true)}
        onMouseLeave={() => setBancoSubOpen(false)}
      >
        <button 
          className={`${styles.menuItem} ${isActive("/cobros") || isActive("/banco") ? styles.active : ""}`} 
          onClick={() => router.push("/cobros")} 
          title="Contabilidad"
        >
          <Icons.Euro size={20} strokeWidth={isActive("/cobros") || isActive("/banco") ? 3 : 2} />
        </button>
 
        {bancoSubOpen && (
          <div className={styles.submenuFlyout}>
            <button 
              className={styles.submenuItem}
              onClick={() => {
                setBancoSubOpen(false);
                router.push("/banco/cierre-caja");
              }}
            >
              <Icons.Logs size={14} className={styles.submenuIcon} />
              <span>Cierre de caja</span>
            </button>
            <button 
              className={styles.submenuItem}
              onClick={() => {
                setBancoSubOpen(false);
                router.push("/banco");
              }}
            >
              <Icons.Landmark size={14} className={styles.submenuIcon} />
              <span>Movimientos banco</span>
            </button>
            <button 
              className={styles.submenuItem}
              onClick={() => {
                setBancoSubOpen(false);
                router.push("/banco/diario");
              }}
            >
              <Icons.Logs size={14} className={styles.submenuIcon} />
              <span>Libro Diario</span>
            </button>
            <button 
              className={styles.submenuItem}
              onClick={() => {
                setBancoSubOpen(false);
                router.push("/banco/balance");
              }}
            >
              <Icons.Balance size={14} className={styles.submenuIcon} />
              <span>Balance sumas/saldos</span>
            </button>
            <button 
              className={styles.submenuItem}
              onClick={() => {
                setBancoSubOpen(false);
                router.push("/banco/iva");
              }}
            >
              <Icons.Iva size={14} className={styles.submenuIcon} />
              <span>Libro de IVA</span>
            </button>
          </div>
        )}
      </div>
 
      <button 
        className={`${styles.menuItem} ${isActive("/mensajes") ? styles.active : ""}`} 
        onClick={() => router.push("/mensajes")} 
        title="Mensajes"
      >
        <Icons.Mensajes size={20} strokeWidth={isActive("/mensajes") ? 3 : 2} />
      </button>
 
      <div className={styles.settingsWrapper}>
        <button
          onClick={onOpenCopiloto}
          title="Copilot AI"
          className={styles.menuItem}
          style={{ color: "var(--primary-color, #4f46e5)", marginBottom: "0.5rem" }}
        >
          <Sparkles size={20} />
        </button>
        <button
          className={`${styles.menuItem} ${isActive("/settings") ? styles.active : ""}`}
          onClick={() => router.push("/settings")}
          title="Ajustes"
        >
          <Icons.Settings size={20} strokeWidth={isActive("/settings") ? 3 : 2} />
        </button>
      </div>
    </aside>
  );
}

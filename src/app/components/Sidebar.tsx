"use client";

import styles from "./MenuPrincipal.module.css";
import { useRouter, usePathname } from "next/navigation";
import { Icons } from "@/lib/icons";
import { Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { getCurrentUsuario } from "@/actions/usuarios";

interface Props {
  onOpenCopiloto?: () => void;
}

export default function MenuPrincipal({ onOpenCopiloto }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [expSubOpen, setExpSubOpen] = useState(false);
  const [presupSubOpen, setPresupSubOpen] = useState(false);
  const [bancoSubOpen, setBancoSubOpen] = useState(false);
  const [campanasSubOpen, setCampanasSubOpen] = useState(false);
  const [pulseSubOpen, setPulseSubOpen] = useState(false);
  const [hoveredCopiloto, setHoveredCopiloto] = useState(false);
  const expTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bancoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const campanasTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function loadUser() {
      const u = await getCurrentUsuario();
      setCurrentUser(u);
    }
    loadUser();
  }, []);

  const isBranchUser = !!(
    currentUser &&
    currentUser.oficina_id &&
    currentUser.rol !== "SuperAdmin" &&
    currentUser.rol !== "Admin" &&
    currentUser.rol !== "Owner"
  );

  const showRadar = currentUser
    ? currentUser.modulos?.radar_activo && !currentUser.modulos?.ocultar_crm
    : true;

  const showLedger = currentUser
    ? currentUser.modulos?.ledger_tax_activo &&
      !currentUser.modulos?.ocultar_contabilidad &&
      !isBranchUser
    : true;

  const showCotizaciones = true;

  const closeAllOthers = (exceptSetter: ((v: boolean) => void) | null) => {
    const submenus = [
      { setter: setExpSubOpen, timer: expTimer },
      { setter: setPresupSubOpen, timer: presupTimer },
      { setter: setBancoSubOpen, timer: bancoTimer },
      { setter: setCampanasSubOpen, timer: campanasTimer },
      { setter: setPulseSubOpen, timer: pulseTimer },
    ];
    for (const sub of submenus) {
      if (sub.setter !== exceptSetter) {
        if (sub.timer.current) {
          clearTimeout(sub.timer.current);
          sub.timer.current = null;
        }
        sub.setter(false);
      }
    }
  };

  const makeHover = (
    setter: (v: boolean) => void,
    timer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  ) => ({
    onMouseEnter: () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      closeAllOthers(setter);
      setter(true);
    },
    onMouseLeave: () => {
      timer.current = setTimeout(() => setter(false), 1000);
    },
  });

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <aside className={styles.menu}>
      <button 
        className={`${styles.menuItem} ${isActive("/dashboard") ? styles.active : ""}`} 
        onClick={() => router.push("/dashboard")} 
        title="Home"
        onMouseEnter={() => closeAllOthers(null)}
      >
        <Icons.Home size={20} strokeWidth={isActive("/dashboard") ? 3 : 2} />
      </button>
 
      {showRadar && (
        <div
          className={styles.menuItemWrapper}
          {...makeHover(setCampanasSubOpen, campanasTimer)}
        >
          <button
            className={`${styles.menuItem} ${styles.moduleRadar} ${isActive("/campanas") || isActive("/oportunidades") || isActive("/contactos") ? styles.active : ""}`}
            title="Campañas"
            onClick={() => router.push("/campanas")}
          >
            <Icons.Target size={20} strokeWidth={isActive("/campanas") || isActive("/oportunidades") ? 3 : 2} />
          </button>

          {campanasSubOpen && (
            <div className={styles.submenuFlyout}>
              <button
                className={styles.submenuItem}
                onClick={() => { setCampanasSubOpen(false); router.push("/campanas"); }}
              >
                <Icons.Target size={14} className={styles.submenuIcon} />
                <span>Campañas</span>
              </button>
              <button
                className={styles.submenuItem}
                onClick={() => { setCampanasSubOpen(false); router.push("/contactos/clientes"); }}
              >
                <Icons.Users size={14} className={styles.submenuIcon} />
                <span>Clientes</span>
              </button>
              <button
                className={styles.submenuItem}
                onClick={() => { setCampanasSubOpen(false); router.push("/contactos/viajeros"); }}
              >
                <Icons.Viajeros size={14} className={styles.submenuIcon} />
                <span>Viajeros</span>
              </button>
              {!isBranchUser && (
                <button
                  className={styles.submenuItem}
                  onClick={() => { setCampanasSubOpen(false); router.push("/contactos/proveedores"); }}
                >
                  <Icons.Building size={14} className={styles.submenuIcon} />
                  <span>Proveedores</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div
        className={styles.menuItemWrapper}
        {...makeHover(setPresupSubOpen, presupTimer)}
      >
        <button
          className={`${styles.menuItem} ${styles.moduleStudio} ${isActive("/presupuestos") || isActive("/cotizaciones") || isActive("/propuestas") ? styles.active : ""}`}
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
            {showCotizaciones && (
              <button
                className={styles.submenuItem}
                onClick={() => { setPresupSubOpen(false); router.push("/cotizaciones"); }}
              >
                <Icons.Cotizacion size={14} className={styles.submenuIcon} />
                <span>Cotizaciones</span>
              </button>
            )}
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
        {...makeHover(setExpSubOpen, expTimer)}
      >
        <button
          className={`${styles.menuItem} ${styles.moduleCore} ${isActive("/expedientes") ? styles.active : ""}`}
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

      {showLedger && (
        <div
          className={styles.menuItemWrapper}
          {...makeHover(setBancoSubOpen, bancoTimer)}
        >
          <button 
            className={`${styles.menuItem} ${styles.moduleAudit} ${isActive("/cobros") || isActive("/banco") ? styles.active : ""}`}
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
      )}

      <div
        className={styles.menuItemWrapper}
        {...makeHover(setPulseSubOpen, pulseTimer)}
      >
        <button
          className={`${styles.menuItem} ${styles.modulePulse} ${isActive("/web") ? styles.active : ""}`}
          title="Fidelización"
        >
          <Icons.Heart size={20} strokeWidth={isActive("/web") ? 3 : 2} />
        </button>

        {pulseSubOpen && (
          <div className={styles.submenuFlyout}>
            <button
              className={styles.submenuItem}
              onClick={() => { setPulseSubOpen(false); router.push("/web"); }}
            >
              <Icons.Propuestas size={14} className={styles.submenuIcon} />
              <span>Web</span>
            </button>
          </div>
        )}
      </div>

      <button
        className={`${styles.menuItem} ${isActive("/mensajes") ? styles.active : ""}`}
        onClick={() => router.push("/mensajes")} 
        title="Mensajes"
        onMouseEnter={() => closeAllOthers(null)}
      >
        <Icons.Mensajes size={20} strokeWidth={isActive("/mensajes") ? 3 : 2} />
      </button>

      <button
        className={styles.menuItem}
        title="Documentos"
        disabled
      >
        <Icons.Documentos size={20} strokeWidth={2} />
      </button>

      <button
        onClick={onOpenCopiloto}
        title="Copilot AI"
        className={styles.menuItem}
        onMouseEnter={() => { closeAllOthers(null); setHoveredCopiloto(true); }}
        onMouseLeave={() => setHoveredCopiloto(false)}
      >
        <img 
          src="/alivia_icon_on.png" 
          alt="Alivia" 
          style={{ 
            width: 20, 
            height: 20, 
            transition: "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)", 
            transform: hoveredCopiloto ? "scale(1.2) rotate(8deg)" : "scale(1)" 
          }} 
        />
      </button>
 
      <div className={styles.settingsWrapper}>
        <button
          className={`${styles.menuItem} ${isActive("/settings") ? styles.active : ""}`}
          onClick={() => router.push("/settings")}
          title="Ajustes"
          onMouseEnter={() => closeAllOthers(null)}
        >
          <Icons.Settings size={20} strokeWidth={isActive("/settings") ? 3 : 2} />
        </button>
      </div>
    </aside>
  );
}

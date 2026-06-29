"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  House,
  Map,
  CreditCard,
  FileText,
  User,
  ArrowLeft,
} from "lucide-react";
import styles from "./page.module.css";

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        padding: "3rem",
        textAlign: "center",
        color: "#94a3b8",
        background: "#e2e8f0",
        borderRadius: "0.75rem",
      }}
    >
      Cargando visor...
    </div>
  ),
});

type Tab = "home" | "itinerario" | "pagos" | "docs" | "user";

interface Expediente {
  id: string;
  numero: string;
  referencia: string;
  destino: string;
  fechaInicio: string;
  fechaFin: string;
  contratoFirmado: boolean;
  viajeros: string;
}

interface Pago {
  id: string;
  fecha: string;
  concepto: string;
  importe: number;
  medioPago: string;
  numeroExp: string;
  referenciaExp: string;
  expedienteId: string;
}

interface ResumenExp {
  id: string;
  numero: string;
  referencia: string;
  entidadNombre: string;
  importeViaje: number;
  extras: number;
  extrasList: { descripcion: string; precio: number }[];
  totalConExtras: number;
  abonado: number;
  restante: number;
}

interface Factura {
  id: string;
  numeroFactura: string;
  fechaEmision: string;
  importeTotal: number;
  estado: string;
  referenciaExp: string;
}

interface Props {
  session: { entityId: string; entityName: string; email: string };
  initialExpedientes: Expediente[];
  initialPagos: Pago[];
  initialResumen: ResumenExp[];
  colorPrimario: string;
  initialFacturas: Factura[];
  initialTab: Tab;
  firmadoExito?: boolean;
}

export default function DashboardClient({
  session,
  initialExpedientes,
  initialPagos,
  initialResumen,
  colorPrimario: initialColor,
  initialFacturas,
  initialTab,
  firmadoExito,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [expedientes, setExpedientes] = useState<Expediente[]>(initialExpedientes);
  const [pagos] = useState<Pago[]>(initialPagos);
  const [resumen] = useState<ResumenExp[]>(initialResumen);
  const [colorPrimario] = useState(initialColor);
  const [facturas] = useState<Factura[]>(initialFacturas);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedExp, setSelectedExp] = useState<Expediente | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingExpId, setLoadingExpId] = useState<string | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [signSuccess, setSignSuccess] = useState<string | null>(null);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleLogout = () => {
    window.location.href = "/api/portal/logout";
  };

  const handlePreview = async (exp: Expediente) => {
    if (isMobile) {
      try {
        const tokenRes = await fetch(`/api/portal/contrato/token?expedienteId=${exp.id}`);
        if (!tokenRes.ok) return;
        const { token } = await tokenRes.json();
        window.open(`/api/portal/contrato/ver?expedienteId=${exp.id}&token=${token}`, "_blank");
      } catch {}
      return;
    }

    setSelectedExp(exp);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);
    setLoadingExpId(null);

    try {
      const tokenRes = await fetch(`/api/portal/contrato/token?expedienteId=${exp.id}`);
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({ error: "Error" }));
        throw new Error(err.error || `Error ${tokenRes.status}`);
      }
      const { token } = await tokenRes.json();
      setPreviewUrl(`/api/portal/contrato/ver?expedienteId=${exp.id}&token=${token}`);
    } catch (err: any) {
      setPreviewError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setSelectedExp(null);
    setPreviewUrl(null);
    setPreviewError(null);
  };

  const handleSign = async (exp: Expediente) => {
    setSigningId(exp.id);
    setSignError(null);
    setSignSuccess(null);

    try {
      const res = await fetch("/api/portal/contrato/firmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expedienteId: exp.id,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSignError(data.error || "Error al firmar");
        return;
      }

      setSignSuccess("Contrato firmado correctamente");
      setExpedientes((prev) =>
        prev.map((e) => (e.id === exp.id ? { ...e, contratoFirmado: true } : e)),
      );

      const pdfRes = await fetch(`/api/portal/contrato/preview?expedienteId=${exp.id}`);
      if (pdfRes.ok) {
        const blob = await pdfRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `contrato_${exp.numero}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setTimeout(() => closePreview(), 1500);
    } catch (err: any) {
      setSignError(err.message || "Error de conexión");
    } finally {
      setSigningId(null);
    }
  };

  return (
    <main className={styles.container}>
      <header className={styles.header} style={{ background: colorPrimario }}>
        {activeTab === "pagos" && resumen.length > 0 ? (
          <div className={styles.headerStack}>
            <h1 className={styles.headerTitle}>{resumen[0].entidadNombre}</h1>
            <span className={styles.headerRef}>{resumen[0].referencia}</span>
          </div>
        ) : (
          <h1 className={styles.headerTitle}>
            {activeTab === "docs" && selectedExp
              ? "Contrato"
              : activeTab === "itinerario"
                ? "Itinerario"
                : activeTab === "user"
                  ? "Mi Perfil"
                  : "Groomy Portal"}
          </h1>
        )}
        {activeTab === "docs" && selectedExp && (
          <button className={styles.headerBack} onClick={closePreview}>
            <ArrowLeft size={16} />
          </button>
        )}
      </header>

      <section className={styles.content}>
        {activeTab === "home" && (
          <div className={styles.tabContent}>
            <div className={styles.homeHero}>
              <h2 className={styles.greeting}>Hola, {session.entityName}</h2>
              <p className={styles.homeSub}>
                Usa el menú inferior para navegar por tus documentos y pagos.
              </p>
            </div>
          </div>
        )}

        {activeTab === "itinerario" && (
          <div className={styles.tabContent}>
            <div className={styles.emptyState}>
              <Map size={32} className={styles.emptyIcon} />
              <p>Aquí verás el detalle de tu viaje.</p>
            </div>
          </div>
        )}

        {activeTab === "pagos" && (
          <PagosTab pagos={pagos} resumen={resumen} colorPrimario={colorPrimario} />
        )}

        {activeTab === "docs" && (
          <DocsTab
            expedientes={expedientes}
            selectedExp={selectedExp}
            previewLoading={previewLoading}
            previewUrl={previewUrl}
            previewError={previewError}
            signError={signError}
            signSuccess={signSuccess}
            signingId={signingId}
            onSelectExp={(exp) => handlePreview(exp)}
            onSign={handleSign}
            onBack={closePreview}
            colorPrimario={colorPrimario}
            facturas={facturas}
            isMobile={isMobile}
            firmadoExito={firmadoExito}
          />
        )}

        {activeTab === "user" && (
          <UserTab session={session} onLogout={handleLogout} />
        )}
      </section>

      <nav className={styles.bottomNav}>
        <a
          href="/portal/dashboard?tab=home"
          onClick={(e) => { e.preventDefault(); setActiveTab("home"); }}
          className={`${styles.navItem} ${activeTab === "home" ? styles.navActive : ""}`}
          style={activeTab === "home" ? { color: colorPrimario } : undefined}
        >
          <House size={22} />
          <span className={styles.navLabel}>Home</span>
        </a>
        <a
          href="/portal/dashboard?tab=itinerario"
          onClick={(e) => { e.preventDefault(); setActiveTab("itinerario"); }}
          className={`${styles.navItem} ${activeTab === "itinerario" ? styles.navActive : ""}`}
          style={activeTab === "itinerario" ? { color: colorPrimario } : undefined}
        >
          <Map size={22} />
          <span className={styles.navLabel}>Itinerario</span>
        </a>
        <a
          href="/portal/dashboard?tab=pagos"
          onClick={(e) => { e.preventDefault(); setActiveTab("pagos"); }}
          className={`${styles.navItem} ${activeTab === "pagos" ? styles.navActive : ""}`}
          style={activeTab === "pagos" ? { color: colorPrimario } : undefined}
        >
          <CreditCard size={22} />
          <span className={styles.navLabel}>Pagos</span>
        </a>
        <a
          href="/portal/dashboard?tab=docs"
          onClick={(e) => { e.preventDefault(); setActiveTab("docs"); }}
          className={`${styles.navItem} ${activeTab === "docs" ? styles.navActive : ""}`}
          style={activeTab === "docs" ? { color: colorPrimario } : undefined}
        >
          <FileText size={22} />
          <span className={styles.navLabel}>Docs</span>
        </a>
        <a
          href="/portal/dashboard?tab=user"
          onClick={(e) => { e.preventDefault(); setActiveTab("user"); }}
          className={`${styles.navItem} ${activeTab === "user" ? styles.navActive : ""}`}
          style={activeTab === "user" ? { color: colorPrimario } : undefined}
        >
          <User size={22} />
          <span className={styles.navLabel}>User</span>
        </a>
      </nav>
    </main>
  );
}

/* ─── Pagos Tab ────────────────────────────────────── */

function PagosTab({
  pagos,
  resumen,
  colorPrimario,
}: {
  pagos: Pago[];
  resumen: ResumenExp[];
  colorPrimario: string;
}) {
  const euro = (n: number) =>
    n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

  const hexToRgba = (hex: string, alpha: number) => {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const color50 = hexToRgba(colorPrimario, 0.5);

  return (
    <div className={styles.tabContent}>
      {resumen.length === 0 && pagos.length === 0 ? (
        <div className={styles.emptyState}>
          <CreditCard size={32} className={styles.emptyIcon} />
          <p>No hay pagos registrados.</p>
        </div>
      ) : (
        <>
          <h2 className={styles.sectionTitle}>Importe del viaje</h2>
          {resumen.map((r) => {
            const needsExtras = r.extras > 0;
            const pct =
              r.totalConExtras > 0
                ? Math.round((r.abonado / r.totalConExtras) * 100)
                : 0;

            return (
              <div key={r.id} className={styles.expResumenCard}>
                <div className={styles.expResumenLine}>
                  <span>Importe base</span>
                  <span className={styles.expResumenVal}>{euro(r.importeViaje)}</span>
                </div>

                {needsExtras && (
                  <div className={styles.extrasBlock}>
                    <span className={styles.extrasBlockTitle}>Extras:</span>
                    {r.extrasList.map((ex, i) => (
                      <div key={i} className={styles.extrasBlockItem}>
                        <span className={styles.extrasDesc}>{ex.descripcion}</span>
                        <span className={styles.extrasPrice}>{euro(ex.precio)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.expResumenDivider} />

                <div className={styles.expResumenLine}>
                  <span className={styles.expResumenLabelBold}>TOTAL</span>
                  <span className={styles.expResumenVal}>{euro(r.totalConExtras)}</span>
                </div>

                <div className={styles.expResumenLine}>
                  <span>Abonado</span>
                  <span className={styles.expResumenAbonado}>{euro(r.abonado)}</span>
                </div>

                <div className={styles.expResumenLine}>
                  <span className={styles.expResumenLabelBold}>Resto</span>
                  <span className={styles.expResumenRestante}>{euro(r.restante)}</span>
                </div>

                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${pct}%`, background: colorPrimario }}
                  />
                </div>
              </div>
            );
          })}

          <h3 className={styles.sectionTitle}>Movimientos</h3>
          <div className={styles.pagoList}>
            {pagos.map((p) => {
              const medioLabel =
                (
                  {
                    banco: "Banco",
                    efectivo: "Efectivo",
                    tarjeta: "Tarjeta",
                    transferencia: "Transferencia",
                    PayPal: "PayPal",
                  } as Record<string, string>
                )[p.medioPago] || p.medioPago;

              return (
                <div key={p.id} className={styles.pagoCard} style={{ borderColor: color50 }}>
                  <span className={styles.pagoMedioBadge} style={{ background: colorPrimario }}>
                    {medioLabel}
                  </span>
                  <div className={styles.pagoHeader}>
                    <span className={styles.pagoFecha}>
                      {p.fecha ? new Date(p.fecha).toLocaleDateString("es-ES") : "—"}
                    </span>
                    <span className={styles.pagoImporte}>{euro(p.importe)}</span>
                  </div>
                  <p className={styles.pagoConcepto}>{p.concepto}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Docs Tab ─────────────────────────────────────── */

function DocsTab({
  expedientes,
  selectedExp,
  previewLoading,
  previewUrl,
  previewError,
  signError,
  signSuccess,
  signingId,
  onSelectExp,
  onSign,
  onBack,
  colorPrimario,
  facturas,
  isMobile,
  firmadoExito,
}: {
  expedientes: Expediente[];
  selectedExp: Expediente | null;
  previewLoading: boolean;
  previewUrl: string | null;
  previewError: string | null;
  signError: string | null;
  signSuccess: string | null;
  signingId: string | null;
  onSelectExp: (exp: Expediente) => void;
  onSign: (exp: Expediente) => void;
  onBack: () => void;
  colorPrimario: string;
  facturas: Factura[];
  isMobile: boolean;
  firmadoExito?: boolean;
}) {
  const [accepted, setAccepted] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);
  const [loadingExpId, setLoadingExpId] = useState<string | null>(null);

  if (selectedFactura) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.docHeader}>
          <h2 className={styles.docTitle}>Factura {selectedFactura.numeroFactura}</h2>
          <p className={styles.docSubtitle}>
            {selectedFactura.fechaEmision
              ? new Date(selectedFactura.fechaEmision).toLocaleDateString("es-ES")
              : "—"}
          </p>
        </div>
        <div style={{ width: "100%", minHeight: "400px", touchAction: "none" }}>
          <PdfViewer url={`/api/facturacion/generar-doc/${selectedFactura.id}`} />
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <a
            href={`/api/facturacion/generar-doc/${selectedFactura.id}`}
            download={`${selectedFactura.numeroFactura}.pdf`}
            className={styles.primaryBtn}
            style={{ textDecoration: "none", display: "block", textAlign: "center", flex: 1, background: colorPrimario }}
          >
            Descargar PDF
          </a>
          <button type="button" className={styles.secondaryBtn} onClick={() => setSelectedFactura(null)}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (!selectedExp) {
    return (
      <div className={styles.tabContent}>
        {firmadoExito && (
          <div className={styles.successBanner}>✓ Contrato firmado correctamente</div>
        )}
        <h2 className={styles.sectionTitle}>Contratos</h2>
        <div className={styles.expList}>
          {expedientes.map((exp) => (
            <div key={exp.id} className={styles.expCard}>
              <div className={styles.expCardBody}>
                <div className={styles.expRow}>
                  <span className={styles.expLabel}>Destino</span>
                  <span>{exp.destino || "—"}</span>
                </div>
                <div className={styles.expRow}>
                  <span className={styles.expLabel}>Viajeros</span>
                  <span>{exp.viajeros || "—"}</span>
                </div>
              </div>
              <div className={styles.expCardFooter}>
                <button
                  type="button"
                  onClick={() => { setLoadingExpId(exp.id); onSelectExp(exp); }}
                  className={styles.primaryBtn}
                  style={{ background: colorPrimario, width: "100%" }}
                >
                  Ver Contrato
                </button>
                {exp.contratoFirmado ? (
                  <span className={styles.signedBadge}>✓ Firmado</span>
                ) : (
                  <form
                    method="post"
                    action="/api/portal/contrato/firmar-form"
                    className={styles.firmarFormNojs}
                  >
                    <input type="hidden" name="expedienteId" value={exp.id} />
                    <label className={styles.firmarCheckLabelNojs}>
                      <input type="checkbox" name="aceptado" required />
                      He leído y acepto el contrato
                    </label>
                    <button type="submit" className={styles.firmarBtnNojs}>
                      ✍ Firmar Contrato
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>

        {facturas.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Facturas</h2>
            <div className={styles.facturaList}>
              {facturas.map((f) => (
                <div key={f.id} className={styles.facturaCard}>
                  <div className={styles.facturaHeader}>
                    <span className={styles.facturaNum}>{f.numeroFactura}</span>
                    <span className={styles.facturaFecha}>
                      {f.fechaEmision
                        ? new Date(f.fechaEmision).toLocaleDateString("es-ES")
                        : "—"}
                    </span>
                  </div>
                  <div className={styles.facturaRow}>
                    <span className={styles.facturaLabel}>Importe</span>
                    <span className={styles.facturaImporte}>
                      {f.importeTotal.toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </span>
                  </div>
                  <div className={styles.facturaActions}>
                    <button
                      type="button"
                      className={styles.facturaBtn}
                      onClick={() => setSelectedFactura(f)}
                    >
                      Ver
                    </button>
                    <a
                      href={`/api/facturacion/generar-doc/${f.id}`}
                      download={`${f.numeroFactura}.pdf`}
                      className={styles.facturaBtn}
                      style={{ textDecoration: "none", textAlign: "center" }}
                    >
                      Descargar
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  if (isMobile && !selectedExp.contratoFirmado) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.docHeader}>
          <h2 className={styles.docTitle}>Contrato {selectedExp.numero}</h2>
          <p className={styles.docSubtitle}>{selectedExp.referencia}</p>
        </div>

        {signSuccess && <div className={styles.successBanner}>{signSuccess}</div>}
        {signError && <div className={styles.errorBanner}>{signError}</div>}

        {previewLoading && (
          <div className={styles.previewPlaceholder}>
            <p>Generando contrato...</p>
          </div>
        )}

        {previewError && (
          <div className={styles.previewPlaceholder}>
            <p className={styles.previewErrorText}>{previewError}</p>
            <button className={styles.secondaryBtn} onClick={() => onSelectExp(selectedExp)}>
              Reintentar
            </button>
          </div>
        )}

        {previewUrl && (
          <div style={{ width: "100%", minHeight: "400px", touchAction: "none" }}>
            <PdfViewer url={previewUrl} />
          </div>
        )}

        <div className={styles.mobileSignBar}>
          <label className={styles.mobileCheckLabel}>
            <input
              type="checkbox"
              className={styles.mobileCheck}
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            Acepto los términos del contrato
          </label>
          <button
            className={styles.mobileSignBtn}
            style={{ background: accepted ? "#16a34a" : "#94a3b8" }}
            disabled={!accepted || signingId === selectedExp.id}
            onClick={() => onSign(selectedExp)}
          >
            {signingId === selectedExp.id ? "Firmando..." : "✍️ Firmar Contrato"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.docHeader}>
        <h2 className={styles.docTitle}>Contrato {selectedExp.numero}</h2>
        <p className={styles.docSubtitle}>{selectedExp.referencia}</p>
      </div>

      {signSuccess && <div className={styles.successBanner}>{signSuccess}</div>}
      {signError && <div className={styles.errorBanner}>{signError}</div>}

      {previewLoading && (
        <div className={styles.previewPlaceholder}>
          <p>Generando contrato...</p>
        </div>
      )}

      {previewError && (
        <div className={styles.previewPlaceholder}>
          <p className={styles.previewErrorText}>{previewError}</p>
          <button className={styles.secondaryBtn} onClick={() => onSelectExp(selectedExp)}>
            Reintentar
          </button>
        </div>
      )}

      {previewUrl && (
        <div style={{ width: "100%", minHeight: "400px", touchAction: "none" }}>
          <PdfViewer url={previewUrl} />
        </div>
      )}

      {previewUrl && !selectedExp.contratoFirmado && (
        <div className={styles.desktopSignCard}>
          <label className={styles.desktopCheckLabel}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            Acepto los términos del contrato
          </label>
          <button
            className={styles.desktopSignBtn}
            style={{ background: accepted ? "#16a34a" : "#94a3b8" }}
            disabled={!accepted || signingId === selectedExp.id}
            onClick={() => onSign(selectedExp)}
          >
            {signingId === selectedExp.id ? "Firmando..." : "Firmar Contrato"}
          </button>
        </div>
      )}

      {selectedExp.contratoFirmado && previewUrl && (
        <div className={styles.signedBadgeLarge}>✓ Contrato firmado</div>
      )}
    </div>
  );
}

/* ─── User Tab ─────────────────────────────────────── */

function UserTab({
  session,
  onLogout,
}: {
  session: { entityName: string; email: string };
  onLogout: () => void;
}) {
  return (
    <div className={styles.tabContent}>
      <div className={styles.profileCard}>
        <div className={styles.avatar}>{session.entityName.charAt(0).toUpperCase()}</div>
        <h2 className={styles.profileName}>{session.entityName}</h2>
        <p className={styles.profileEmail}>{session.email}</p>
      </div>
      <a
        href="/api/portal/logout"
        onClick={(e) => { e.preventDefault(); onLogout(); }}
        className={styles.logoutBtn}
        style={{ textDecoration: "none", display: "block", textAlign: "center" }}
      >
        Cerrar sesión
      </a>
    </div>
  );
}
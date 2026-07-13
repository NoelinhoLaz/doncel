"use client";

import { useState, useRef, useCallback, useEffect, Fragment } from "react";
import { Info, Layers, Unlink, Copy, Trash2, ClipboardPaste, Mail, Users, Moon } from "lucide-react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
const NuevaComunicacionModal = dynamic(() => import("@/app/expedientes/[id]/components/NuevaComunicacionModal"), { ssr: false });
import { Icons } from "@/lib/icons";
import Pagination from "@/app/components/Pagination";
import ProviderSelector from "@/app/expedientes/[id]/components/ProviderSelector";
import DestinationSelector from "@/app/expedientes/[id]/components/DestinationSelector";
import TipoIcon from "./TipoIcon";
import AccionesLineaCell from "@/app/components/ui/AccionesLineaCell";
import TipoSelectorPopup from "@/app/components/ui/TipoSelectorPopup";
import { formatCurrency } from "@/hooks/useCotizacion";
import type { useCotizacion } from "@/hooks/useCotizacion";
import styles from "@/app/expedientes/[id]/page.module.css";
import listStyles from "@/app/expedientes/page.module.css";
import tablaStyles from "./tabla.module.css";

type CotizacionHook = ReturnType<typeof useCotizacion>;

interface Props {
  c: CotizacionHook;
  hideHeader?: boolean;
  compactHeader?: boolean;
  title?: string;
  sidePanel?: ReactNode;
  cotizacionId?: string | null;
}

const fieldStyle: React.CSSProperties = {
  background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.1rem 0.3rem',
  borderRadius: 6, height: 25, color: 'inherit', boxSizing: 'border-box', fontSize: '0.7rem',
};

function getGroupColor(groupId: string | null | undefined) {
  return groupId ? 'var(--primary-color, #475569)' : undefined;
}

function getGroupLabel(groupId: string, displayItems: any[]): string {
  const ids = ([...new Set(displayItems.map(i => i.grupo_alternativa_id).filter(Boolean))] as string[]).sort();
  const idx = ids.indexOf(groupId);
  return String.fromCharCode(65 + (idx >= 0 ? idx % 26 : 0));
}

export default function TablaCotizacion({ c, hideHeader, compactHeader, title, sidePanel, cotizacionId }: Props) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [mailModalProveedor, setMailModalProveedor] = useState<{ nombre: string; email: string } | null>(null);
  const [openTipoRowId, setOpenTipoRowId] = useState<string | null>(null);

  useEffect(() => {
    if (!openTipoRowId) return;
    const close = () => setOpenTipoRowId(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [openTipoRowId]);

  // ── Google Sheets import state ──────────────────────────────────
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [sheetsStep, setSheetsStep] = useState<'paste' | 'preview'>('paste');
  const [sheetsText, setSheetsText] = useState('');
  const [previewRows, setPreviewRows] = useState<Array<{
    include: boolean;
    proveedor: string;
    plazas: number;
    neto: number;
    noches: number;
    total: number;
    tipoId: string;
    opcional: boolean;
  }>>([]);
  const [sheetsResult, setSheetsResult] = useState<{ imported: number } | null>(null);
  const [openTipoPopupIdx, setOpenTipoPopupIdx] = useState<number | null>(null);
  const sheetsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const defaultTipoId = Object.keys(c.tiposMap)[0] ?? '';

  useEffect(() => {
    if (showSheetsModal && sheetsStep === 'paste' && sheetsTextareaRef.current) {
      setTimeout(() => sheetsTextareaRef.current?.focus(), 60);
    }
  }, [showSheetsModal, sheetsStep]);

  // Global Ctrl+Shift+V shortcut
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
      e.preventDefault();
      openSheetsModal();
    }
  }, []);
  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  const openSheetsModal = () => {
    setSheetsText('');
    setSheetsStep('paste');
    setSheetsResult(null);
    setPreviewRows([]);
    setShowSheetsModal(true);
  };

  const limpiarNumero = (val: string): number => {
    if (!val || !val.trim()) return 0;
    const n = parseFloat(val.replace(/[^\d.,-]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };

  const parsePaste = (raw: string) => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    // Skip header if first row's numeric cols are all 0
    let start = 0;
    if (lines.length > 1) {
      const cols = lines[0].split('\t');
      const nums = [cols[1], cols[2], cols[3], cols[4]].map(limpiarNumero);
      if (nums.every(n => n === 0)) start = 1;
    }
    return lines.slice(start).map(line => {
      const cols = line.split('\t');
      const proveedor = (cols[0] ?? '').trim();
      const plazas   = limpiarNumero(cols[1]);
      const neto     = limpiarNumero(cols[2]);
      const noches   = limpiarNumero(cols[3]);
      const total    = limpiarNumero(cols[4]);
      const isEmpty  = !proveedor && plazas === 0 && neto === 0;
      return { include: !isEmpty, proveedor, plazas: plazas || 1, neto, noches, total, tipoId: defaultTipoId, opcional: false };
    });
  };

  const handlePasteAndPreview = (raw: string) => {
    const rows = parsePaste(raw);
    setPreviewRows(rows);
    setSheetsStep('preview');
  };

  const doFinalImport = () => {
    const toImport = previewRows.filter(r => r.include);
    if (!toImport.length) return;
    const imported = c.handleImportFromSheets(toImport);
    setSheetsResult({ imported });
    setTimeout(() => { setShowSheetsModal(false); setSheetsResult(null); }, 2200);
  };


  return (
    <>
      {!hideHeader && (
        <div className={styles.listHeaderTop} style={{ borderTopLeftRadius: '0.75rem', borderTopRightRadius: '0.75rem' }}>
          <div className={styles.listTitleWrapper}>
            <Icons.Facturacion size={18} className={styles.titleIcon} />
            <h2 className={styles.listTitle}>{title || "Servicios cotizados"}</h2>
          </div>
          <div className={styles.actionsWrapper}>
            <div className={styles.searchWrapper}>
              <Icons.Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Buscar línea cotización..."
                className={styles.searchInput}
                value={c.search}
                onChange={(e) => c.setSearch(e.target.value)}
              />
            </div>
            <button
              className={styles.actionIconButton}
              title="Importar desde Google Sheets / Excel (Ctrl+Shift+V)"
              onClick={openSheetsModal}
            >
              <ClipboardPaste size={16} />
            </button>
            <button className={styles.actionIconButton} title="Historial de cotizaciones" onClick={() => c.openHistoryModal()}>
              <Icons.History size={16} />
            </button>
            <div ref={c.addBtnRef} style={{ position: 'relative' }}>
              <button
                className={styles.addActionButton}
                title="Nueva cotización"
                onClick={() => {
                  if (compactHeader) c.setShowAddTipoPopup(true);
                  else c.router.push("/cotizaciones/nueva");
                }}
              >
                <Icons.Add size={14} />
              </button>
              {c.showAddTipoPopup && compactHeader && (
                <div className={tablaStyles.tipoPopup}>
                  {Object.values(c.tiposMap).length === 0 ? (
                    <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>Sin tipos</div>
                  ) : (
                    Object.values(c.tiposMap).map((t: any) => (
                      <div key={t.id} title={t.etiqueta} className={tablaStyles.tipoPopupItem} onClick={() => c.handleAddItemByTipo(t)}>
                        <TipoIcon iconName={t.icono} size={14} />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Google Sheets Import Modal ─────────────────────────────── */}
      {showSheetsModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowSheetsModal(false); setOpenTipoPopupIdx(null); } }}
        >
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.75rem 2rem', width: sheetsStep === 'preview' ? 'min(900px, 97vw)' : 'min(560px, 95vw)', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 24px 70px rgba(0,0,0,0.22)', transition: 'width 0.2s' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <ClipboardPaste size={20} style={{ color: '#6366f1', flexShrink: 0 }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.97rem', fontWeight: 700, color: '#1e293b' }}>Importar desde Google Sheets / Excel</h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                    {sheetsStep === 'paste'
                      ? 'Paso 1 de 2 — Pega las filas copiadas'
                      : `Paso 2 de 2 — Revisa y asigna tipo de servicio por línea`}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowSheetsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.2rem', lineHeight: 1, padding: '2px 6px', borderRadius: 4 }}>✕</button>
            </div>

            {/* Step indicators */}
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              {['Pegar datos', 'Revisar y asignar tipos'].map((label, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, background: (sheetsStep === 'paste' ? i === 0 : i === 1) ? '#6366f1' : (sheetsStep === 'preview' && i === 0 ? '#22c55e' : '#e2e8f0'), color: (sheetsStep === 'paste' ? i === 0 : i === 1) ? '#fff' : (sheetsStep === 'preview' && i === 0 ? '#fff' : '#94a3b8') }}>{sheetsStep === 'preview' && i === 0 ? '✓' : i + 1}</div>
                  <span style={{ fontSize: '0.75rem', color: (sheetsStep === 'paste' ? i === 0 : i === 1) ? '#6366f1' : '#94a3b8', fontWeight: (sheetsStep === 'paste' ? i === 0 : i === 1) ? 600 : 400 }}>{label}</span>
                  {i === 0 && <div style={{ width: 32, height: 1, background: '#e2e8f0', margin: '0 0.1rem' }} />}
                </div>
              ))}
            </div>

            {/* Content */}
            {sheetsResult ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.6rem', padding: '1.5rem', textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                <p style={{ margin: 0, fontWeight: 700, color: '#15803d', fontSize: '1rem' }}>{sheetsResult.imported} línea{sheetsResult.imported !== 1 ? 's' : ''} importada{sheetsResult.imported !== 1 ? 's' : ''} correctamente</p>
              </div>
            ) : sheetsStep === 'paste' ? (
              <>
                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '0.6rem', padding: '0.75rem 1rem', fontSize: '0.74rem', color: '#64748b', flexShrink: 0 }}>
                  Copia las celdas desde Google Sheets o Excel incluyendo la cabecera (<kbd style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: 3, border: '1px solid #e2e8f0' }}>Ctrl+C</kbd>) y pega aquí (<kbd style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: 3, border: '1px solid #e2e8f0' }}>Ctrl+V</kbd>).
                  Columnas esperadas: <strong>Proveedor · Plazas · Precio Unit · Nº Noches · Total</strong>
                </div>
                <textarea
                  ref={sheetsTextareaRef}
                  value={sheetsText}
                  onChange={(e) => setSheetsText(e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text/plain');
                    if (text.includes('\t')) {
                      e.preventDefault();
                      handlePasteAndPreview(text);
                    }
                  }}
                  placeholder="Proveedor&#9;Plazas&#9;Precio Unit&#9;Nº Noches&#9;Total
IB+UX&#9;9&#9;130&#9;1&#9;1170
HOTEL MILAN&#9;80&#9;45&#9;2&#9;7200
..."
                  style={{ flex: 1, minHeight: 180, border: '1.5px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.65rem 0.8rem', fontSize: '0.78rem', fontFamily: 'monospace', color: '#334155', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6, transition: 'border-color 0.15s' }}
                  onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                  onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
                />
                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', flexShrink: 0 }}>
                  <button type="button" onClick={() => setShowSheetsModal(false)} style={{ padding: '0.45rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff', color: '#64748b', fontSize: '0.82rem', cursor: 'pointer' }}>Cancelar</button>
                  <button type="button" onClick={() => sheetsText.trim() && handlePasteAndPreview(sheetsText)} disabled={!sheetsText.trim()} style={{ padding: '0.45rem 1.2rem', border: 'none', borderRadius: '0.5rem', background: sheetsText.trim() ? '#6366f1' : '#e2e8f0', color: sheetsText.trim() ? '#fff' : '#94a3b8', fontSize: '0.82rem', fontWeight: 600, cursor: sheetsText.trim() ? 'pointer' : 'not-allowed' }}>Siguiente →</button>
                </div>
              </>
            ) : (
              <>
                {/* Preview table */}
                <div style={{ overflowY: 'auto', flex: 1, borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                        <th style={{ padding: '0.45rem 0.5rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: 30, color: '#64748b', fontWeight: 600 }}>
                          <input type="checkbox" checked={previewRows.every(r => r.include)} onChange={(e) => setPreviewRows(prev => prev.map(r => ({ ...r, include: e.target.checked })))} />
                        </th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Proveedor / Descripción</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600, width: 60 }}>Plazas</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600, width: 82 }}>P. Unit</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600, width: 62 }}>Noches</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600, width: 82 }}>Total</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600, width: 54 }} title="Tipo de servicio">Tipo</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600, width: 66 }}
                          title="Marcar como servicio opcional">
                          Extra
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => (
                        <tr key={idx} style={{ background: row.include ? (idx % 2 === 0 ? '#fff' : '#fafafa') : '#f8fafc', opacity: row.include ? 1 : 0.45, transition: 'opacity 0.15s' }}>
                          <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                            <input type="checkbox" checked={row.include} onChange={(e) => setPreviewRows(prev => prev.map((r, i) => i === idx ? { ...r, include: e.target.checked } : r))} />
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', borderBottom: '1px solid #f1f5f9', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <input
                              value={row.proveedor}
                              onChange={(e) => setPreviewRows(prev => prev.map((r, i) => i === idx ? { ...r, proveedor: e.target.value } : r))}
                              style={{ width: '100%', border: '1px solid transparent', borderRadius: 4, padding: '1px 4px', fontSize: '0.76rem', background: 'transparent', outline: 'none' }}
                              onFocus={(e) => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#cbd5e1'; }}
                              onBlur={(e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }}
                            />
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{row.plazas}</td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{row.neto.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{row.noches}</td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: '#1e293b' }}>{row.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                          <td style={{ padding: '0.25rem 0.4rem', borderBottom: '1px solid #f1f5f9', textAlign: 'center', position: 'relative' }}>
                            {(() => {
                              const selectedTipo = c.tiposMap[row.tipoId] as any;
                              return (
                                <>
                                  <button
                                    type="button"
                                    disabled={!row.include}
                                    onClick={() => setOpenTipoPopupIdx(openTipoPopupIdx === idx ? null : idx)}
                                    title={selectedTipo?.etiqueta ?? 'Sin tipo'}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      width: 28, height: 28, borderRadius: 6,
                                      border: '1px solid', borderColor: openTipoPopupIdx === idx ? '#6366f1' : '#e2e8f0',
                                      background: openTipoPopupIdx === idx ? '#eef2ff' : '#fff',
                                      color: openTipoPopupIdx === idx ? '#6366f1' : '#475569',
                                      cursor: row.include ? 'pointer' : 'not-allowed',
                                      transition: 'all 0.15s', opacity: row.include ? 1 : 0.5,
                                    }}
                                  >
                                    <TipoIcon iconName={selectedTipo?.icono} size={13} />
                                  </button>
                                  {openTipoPopupIdx === idx && (
                                    <div
                                      style={{
                                        position: 'absolute', zIndex: 50, top: '100%', left: '50%', transform: 'translateX(-50%)',
                                        marginTop: 4, background: '#fff', border: '1px solid #e2e8f0',
                                        borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                        padding: '0.3rem', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {Object.values(c.tiposMap).map((t: any) => (
                                        <button
                                          key={t.id}
                                          type="button"
                                          title={t.etiqueta}
                                          onClick={() => { setPreviewRows(prev => prev.map((r, i) => i === idx ? { ...r, tipoId: t.id } : r)); setOpenTipoPopupIdx(null); }}
                                          style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            padding: '0.4rem', borderRadius: 6, border: 'none',
                                            background: t.id === row.tipoId ? '#eef2ff' : 'transparent',
                                            color: t.id === row.tipoId ? '#6366f1' : '#64748b',
                                            cursor: 'pointer', flexShrink: 0,
                                          }}
                                        >
                                          <TipoIcon iconName={t.icono} size={14} />
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                            <input
                              type="checkbox"
                              checked={row.opcional}
                              disabled={!row.include}
                              onChange={(e) => setPreviewRows(prev => prev.map((r, i) => i === idx ? { ...r, opcional: e.target.checked } : r))}
                              title="Marcar como servicio opcional / extra"
                              style={{ cursor: row.include ? 'pointer' : 'not-allowed', accentColor: '#f59e0b' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    <strong style={{ color: '#6366f1' }}>{previewRows.filter(r => r.include).length}</strong> de {previewRows.length} líneas seleccionadas
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button type="button" onClick={() => setSheetsStep('paste')} style={{ padding: '0.45rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff', color: '#64748b', fontSize: '0.82rem', cursor: 'pointer' }}>← Volver</button>
                    <button type="button" onClick={doFinalImport} disabled={previewRows.filter(r => r.include).length === 0} style={{ padding: '0.45rem 1.3rem', border: 'none', borderRadius: '0.5rem', background: previewRows.filter(r => r.include).length > 0 ? '#6366f1' : '#e2e8f0', color: previewRows.filter(r => r.include).length > 0 ? '#fff' : '#94a3b8', fontSize: '0.82rem', fontWeight: 700, cursor: previewRows.filter(r => r.include).length > 0 ? 'pointer' : 'not-allowed' }}
                    >
                      ✓ Importar {previewRows.filter(r => r.include).length} línea{previewRows.filter(r => r.include).length !== 1 ? 's' : ''}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {c.loading ? (
        <div style={{ padding: "2rem", color: "#64748b" }}>Cargando cotizaciones...</div>
      ) : (
        <div style={{ display: 'flex', gap: '1.25rem', padding: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className={listStyles.tableContainer} style={{ overflow: 'visible', flex: '1 1 650px', minWidth: 0, boxShadow: 'none', border: 'none', background: 'transparent', padding: 0 }}>
            <table className={styles.table} style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: 28 }} />
                <col style={{ width: 36 }} />
                <col />
                <col style={{ width: 180 }} />
                <col style={{ width: 180 }} />
                <col style={{ width: 42 }} />
                <col style={{ width: 42 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 56 }} />
              </colgroup>
              <thead>
                <tr>
                  <th />
                  <th style={{ whiteSpace: 'nowrap' }}>TIPO</th>
                  <th>Descripción</th>
                  <th>Proveedor</th>
                  <th>Destino</th>
                  <th style={{ textAlign: 'right' }} title="Plazas"><Users size={13} style={{ display: 'inline-block', verticalAlign: 'middle' }} /></th>
                  <th style={{ textAlign: 'right' }} title="Noches"><Moon size={13} style={{ display: 'inline-block', verticalAlign: 'middle' }} /></th>
                  <th style={{ textAlign: 'right' }}>Neto</th>
                  <th style={{ textAlign: 'right' }}>PVP</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Tot. Neto</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Tot. PVP</th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {c.paginated.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                      No hay líneas en esta cotización. Usa el botón + para añadir.
                    </td>
                  </tr>
                ) : (() => {
                  const sorted = [...c.paginated].sort((a: any, b: any) => {
                    const oa = Number(!!a.opcional);
                    const ob = Number(!!b.opcional);
                    if (oa !== ob) return oa - ob;
                    const ga = a.grupo_alternativa_id || '';
                    const gb = b.grupo_alternativa_id || '';
                    if (ga && gb && ga === gb) return 0;
                    if (ga && !gb) return -1;
                    if (!ga && gb) return 1;
                    if (ga && gb && ga !== gb) return ga < gb ? -1 : 1;
                    return 0;
                  });
                  const firstOpcionalIndex = sorted.findIndex((it: any) => !!it.opcional);
                  const seenGroups = new Set<string>();
                  return sorted.map((it: any, index: number) => {
                  const groupColor = getGroupColor(it.grupo_alternativa_id);
                  const isInGroup = !!it.grupo_alternativa_id;
                  const isUnchecked = isInGroup && c.checkedIds[it.id] === false;
                  const isGroupLeader = isInGroup && !seenGroups.has(it.grupo_alternativa_id);
                  if (isInGroup) seenGroups.add(it.grupo_alternativa_id);
                  return (
                    <Fragment key={it.id}>
                    {index === firstOpcionalIndex && (
                      <tr>
                        <td colSpan={13} style={{ padding: '0.75rem 1rem 0.5rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>OPCIONALES</span>
                            <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr style={groupColor ? { borderLeft: `3px solid ${groupColor}`, background: isUnchecked ? '#f8fafc' : undefined } : {}}>
                      <td style={{ verticalAlign: 'middle', width: '1%' }}>
                        <input
                          type="checkbox"
                          checked={c.checkedIds[it.id] !== false}
                          onChange={(e) => c.handleCheckedChange(it.id, e.target.checked, it.grupo_alternativa_id)}
                          aria-label={`Seleccionar ${it.id}`}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap', width: compactHeader ? '32px' : '1%', verticalAlign: 'middle', position: 'relative' }}>
                        <TipoSelectorPopup
                          tipos={Object.values(c.tiposMap).map((t: any) => ({ id: t.id, label: t.etiqueta, icono: t.icono }))}
                          selectedId={it.config_tipos_servicios?.id || it.tipo}
                          selectedIcono={it.config_tipos_servicios?.icono || c.tiposMap[it.tipo]?.icono}
                          selectedLabel={it.config_tipos_servicios?.etiqueta || c.tiposMap[it.tipo]?.etiqueta}
                          isOpen={openTipoRowId === it.id}
                          onToggle={() => setOpenTipoRowId(openTipoRowId === it.id ? null : it.id)}
                          onSelect={(tipoId) => { c.handleItemChange(it.id, 'tipo', tipoId); setOpenTipoRowId(null); }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          defaultValue={it.descripcion ?? ''}
                          key={it.id + '-desc'}
                          onBlur={(e) => c.handleItemChange(it.id, 'descripcion', e.target.value)}
                          style={{ ...fieldStyle, width: '100%' }}
                        />
                      </td>
                      <td>
                        <ProviderSelector
                          value={it.proveedor ?? ''}
                          label={(() => { const n = it.contabilidad_proveedores?.nombre || it.contabilidad_proveedores?.razon_social || ''; return n.length > 32 ? n.slice(0, 31) + '…' : n; })()}
                          onChange={(val) => c.handleItemChange(it.id, 'proveedor', val)}
                          compact
                        />
                      </td>
                      <td>
                        <DestinationSelector
                          value={it.destino ?? ''}
                          label={(() => { const d = it.maestro_destinos; if (!d) return ''; const name = d.nombre_comercial || d.nombre || ''; const area = d.admin_area_l2 || d.admin_area_l1 || ''; const full = area ? `${name}, ${area}` : name; return full.length > 32 ? full.slice(0, 31) + '…' : full; })()}
                          onChange={(val) => c.handleItemChange(it.id, 'destino', val)}
                          compact
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="text"
                          key={it.id + '-plazas'}
                          defaultValue={it.plazas ?? ''}
                          maxLength={3}
                          onBlur={(e) => { const v = e.target.value.replace(/\D/g, ''); c.handleItemChange(it.id, 'plazas', v ? Number(v) : null); }}
                          style={{ ...fieldStyle, width: '100%', padding: '0.2rem', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="text"
                          key={it.id + '-noches'}
                          defaultValue={it.noches ?? ''}
                          maxLength={3}
                          onBlur={(e) => { const v = e.target.value.replace(/\D/g, ''); c.handleItemChange(it.id, 'noches', v ? Number(v) : null); }}
                          style={{ ...fieldStyle, width: '100%', padding: '0.2rem', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="text"
                          key={it.id + '-neto'}
                          defaultValue={!it.neto || Number(it.neto) === 0 ? '' : it.neto}
                          onBlur={(e) => c.handleItemChange(it.id, 'neto', e.target.value)}
                          style={{ ...fieldStyle, width: '100%', padding: '0.2rem', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="text"
                          key={it.id + '-pvp'}
                          defaultValue={!it.pvp || Number(it.pvp) === 0 ? '' : it.pvp}
                          onBlur={(e) => c.handleItemChange(it.id, 'pvp', e.target.value)}
                          style={{ ...fieldStyle, width: '100%', padding: '0.2rem', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        {formatCurrency(it.total_neto ?? (Number(it.neto || 0) * Number(it.plazas || 0) * Number(it.noches || 0)))}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        {formatCurrency(it.total_pvp ?? (Number(it.pvp || 0) * Number(it.plazas || 0) * Number(it.noches || 0)))}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        <button
                          type="button"
                          onClick={() => c.handleItemChange(it.id, 'confirmado', !it.confirmado)}
                          title={it.confirmado ? 'Confirmado — clic para marcar como pendiente' : 'Pendiente de confirmar — clic para confirmar'}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.2rem 0.5rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer',
                            fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
                            backgroundColor: it.confirmado ? '#f0fdf4' : '#fffbeb',
                            color: it.confirmado ? '#16a34a' : '#d97706',
                          }}
                        >
                          {it.confirmado ? 'Confirmado' : 'Pendiente'}
                        </button>
                      </td>
                      <td style={{ verticalAlign: 'middle', width: '1%', whiteSpace: 'nowrap', position: 'relative' }}>
                        {deleteConfirmId === it.id ? (
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: '#fef2f2', border: '1px solid #fca5a5', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '0.65rem', color: '#b91c1c', fontWeight: 'bold', whiteSpace: 'nowrap' }}>¿Eliminar?</span>
                            <button type="button" style={{ border: 'none', background: '#ef4444', color: '#fff', borderRadius: '3px', padding: '1px 4px', fontSize: '0.62rem', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => { c.handleDeleteItem(it.id); setDeleteConfirmId(null); }}>Sí</button>
                            <button type="button" style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', borderRadius: '3px', padding: '1px 4px', fontSize: '0.62rem', cursor: 'pointer' }} onClick={() => setDeleteConfirmId(null)}>No</button>
                          </div>
                        ) : (
                          <AccionesLineaCell
                            rowId={it.id}
                            isLinked={!!it.is_linked}
                            linkTitleLinked="Vinculado a servicio de expediente"
                            linkTitleUnlinked="No vinculado a ningún servicio de expediente"
                            onLinkClick={typeof it.id === 'string' && !it.id.startsWith('new-') ? () => c.handleVincularExpediente(it.id) : undefined}
                            saveStatus={c.saveStatus[it.id]}
                            actions={[
                              { icon: <Info size={13} />, title: "Formulario del servicio", onClick: () => c.openInfoModal(it) },
                              isInGroup && !isGroupLeader
                                ? { icon: <Unlink size={13} />, title: "Desagrupar esta alternativa", onClick: () => c.handleUngroup(it) }
                                : { icon: <Layers size={13} />, title: "Crear alternativa", onClick: () => c.handleCreateAlternative(it) },
                              { icon: <Copy size={13} />, title: "Duplicar fila", onClick: () => c.handleDuplicateItem(it) },
                              { icon: <Mail size={13} />, title: it.contabilidad_proveedores?.email ? `Enviar email a ${it.contabilidad_proveedores.nombre || it.contabilidad_proveedores.razon_social}` : "Enviar email al proveedor", onClick: () => setMailModalProveedor({ nombre: it.contabilidad_proveedores?.nombre || it.contabilidad_proveedores?.razon_social || it.descripcion || "", email: it.contabilidad_proveedores?.email || "" }) },
                              ...(c.canDelete ? [{ icon: <Trash2 size={13} />, title: "Eliminar fila", onClick: () => setDeleteConfirmId(it.id), danger: true }] : []),
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                    </Fragment>
                  );
                  });
                })()}
              </tbody>
            </table>

            <Pagination
              currentPage={c.currentPage}
              totalItems={c.filtered.length}
              itemsPerPage={c.rowsPerPage}
              onPageChange={c.setCurrentPage}
              onItemsPerPageChange={c.setRowsPerPage}
            />
          </div>

          {sidePanel}
        </div>
      )}

      {mailModalProveedor && (
        <NuevaComunicacionModal
          cotizacionId={cotizacionId || undefined}
          destinatarioInicial={mailModalProveedor}
          onClose={() => setMailModalProveedor(null)}
          onSent={() => setMailModalProveedor(null)}
        />
      )}
    </>
  );
}

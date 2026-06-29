"use client";

import { useState, useEffect, useMemo } from "react";
import { Banknote, CreditCard } from "lucide-react";
import { Icons } from "@/lib/icons";
import { getCuentasBancarias } from "@/actions/cuentasBancarias";
import { registrarCobroOficina } from "@/actions/cobros";
import styles from "./cobroOficina.module.css";

interface PagadorSimple {
  entidad_id: string;
  contabilidad_entidades?: { nombre: string } | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  expedienteId: string;
  pagadores: PagadorSimple[];
  viajeros: any[];
  onSuccess: () => void;
}

export default function ModalCobroOficina({ isOpen, onClose, expedienteId, pagadores, viajeros, onSuccess }: Props) {
  const [metodoCobro, setMetodoCobro] = useState<"efectivo" | "tarjeta" | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [selectedViajerosIds, setSelectedViajerosIds] = useState<string[]>([]);
  const [selectedClientesIds, setSelectedClientesIds] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [importeCobro, setImporteCobro] = useState("");
  const [tiqueTPV, setTiqueTPV] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingCuentas(true);
    getCuentasBancarias()
      .then((data) => setCuentas(data || []))
      .catch((err) => console.error("Error fetching bank accounts:", err))
      .finally(() => setLoadingCuentas(false));
  }, [isOpen]);

  const listViajeros = useMemo(() => {
    return viajeros.map((v) => {
      const pagador = pagadores.find((p) => p.entidad_id === v.pagador_id);
      return {
        id: v.id,
        nombre: v.contabilidad_entidades?.nombre || v.tutores?.nombre || "Viajero sin nombre",
        pagadorNombre: pagador?.contabilidad_entidades?.nombre || "Sin pagador",
      };
    });
  }, [viajeros, pagadores]);

  const listClientes = useMemo(() => {
    return pagadores.map((p) => ({
      id: p.entidad_id,
      nombre: p.contabilidad_entidades?.nombre || "Cliente sin nombre",
    }));
  }, [pagadores]);

  const filteredListViajeros = useMemo(() => {
    const term = dropdownSearch.trim().toLowerCase();
    if (!term) return listViajeros;
    return listViajeros.filter(
      (v) => v.nombre.toLowerCase().includes(term) || v.pagadorNombre.toLowerCase().includes(term)
    );
  }, [listViajeros, dropdownSearch]);

  const filteredListClientes = useMemo(() => {
    const term = dropdownSearch.trim().toLowerCase();
    if (!term) return listClientes;
    return listClientes.filter((c) => c.nombre.toLowerCase().includes(term));
  }, [listClientes, dropdownSearch]);

  const filteredCuentas = useMemo(() => {
    if (!metodoCobro) return [];
    const prefix = metodoCobro === "tarjeta" ? "5725" : "5700";
    return cuentas.filter((c) => (c.cuenta_contable || "").startsWith(prefix));
  }, [metodoCobro, cuentas]);

  const toggleViajeroSelection = (id: string) => {
    setSelectedViajerosIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setIsDropdownOpen(false);
  };

  const toggleClienteSelection = (id: string) => {
    setSelectedClientesIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setIsDropdownOpen(false);
  };

  const handleClose = () => {
    setMetodoCobro(null);
    setSelectedAccountId("");
    setSelectedViajerosIds([]);
    setSelectedClientesIds([]);
    setIsDropdownOpen(false);
    setDropdownSearch("");
    setImporteCobro("");
    setTiqueTPV("");
    setIsSubmitting(false);
    setModalStep(1);
    onClose();
  };

  const handleConfirmar = async () => {
    if (!expedienteId || !metodoCobro || !selectedAccountId || !importeCobro) return;
    if (selectedViajerosIds.length === 0 && selectedClientesIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await registrarCobroOficina({
        expediente_id: expedienteId,
        medio_pago: metodoCobro,
        cuenta_bancaria_id: selectedAccountId,
        selectedViajerosIds,
        selectedClientesIds,
        importe: parseFloat(importeCobro),
        tique: metodoCobro === "tarjeta" ? tiqueTPV : undefined,
      });
      if (res.success) {
        handleClose();
        onSuccess();
      } else {
        alert(`Error al registrar el cobro: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error al registrar el cobro: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const canProceed = !!metodoCobro && !!selectedAccountId;
  const canConfirm =
    !isSubmitting &&
    (selectedViajerosIds.length > 0 || selectedClientesIds.length > 0) &&
    !!importeCobro &&
    Number(importeCobro) > 0;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <Icons.Add size={18} style={{ color: "#fff" }} />
            </div>
            <div>
              <div className={styles.headerTitle}>Registrar Cobro en Oficina</div>
              <div className={styles.headerSubtitle}>
                {modalStep === 1
                  ? "Paso 1: Selecciona la forma de cobro y la cuenta bancaria"
                  : "Paso 2: Selecciona los viajeros y clientes asociados"}
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={handleClose}>
            <Icons.Close size={20} />
          </button>
        </div>

        {/* Wizard Slider */}
        <div className={`${styles.slider} ${modalStep === 1 ? styles.sliderStep1 : styles.sliderStep2}`}>
          {/* PASO 1 */}
          <div className={styles.step}>
            <div>
              <label className={styles.methodLabel}>Selecciona la forma de cobro:</label>
              <div className={styles.methodCards}>
                <div
                  className={`${styles.methodCard} ${metodoCobro === "efectivo" ? styles.active : ""}`}
                  onClick={() => { setMetodoCobro("efectivo"); setSelectedAccountId(""); }}
                >
                  <Banknote
                    size={28}
                    style={{ color: metodoCobro === "efectivo" ? "var(--primary-color, #475569)" : "#64748b" }}
                  />
                  <span className={styles.methodCardLabel}>Efectivo</span>
                </div>
                <div
                  className={`${styles.methodCard} ${metodoCobro === "tarjeta" ? styles.active : ""}`}
                  onClick={() => { setMetodoCobro("tarjeta"); setSelectedAccountId(""); }}
                >
                  <CreditCard
                    size={28}
                    style={{ color: metodoCobro === "tarjeta" ? "var(--primary-color, #475569)" : "#64748b" }}
                  />
                  <span className={styles.methodCardLabel}>Tarjeta / TPV</span>
                </div>
              </div>
            </div>

            {metodoCobro && (
              <div className={styles.accountSection}>
                <label className={styles.fieldLabel}>Selecciona la cuenta bancaria:</label>
                {loadingCuentas ? (
                  <div className={styles.loadingText}>
                    <Icons.RefreshCw size={14} style={{ animation: "cobroSpin 1s linear infinite" }} />
                    Cargando cuentas...
                  </div>
                ) : filteredCuentas.length === 0 ? (
                  <div className={styles.noAccountsMsg}>
                    No se encontraron cuentas bancarias que empiecen por{" "}
                    {metodoCobro === "tarjeta" ? "5725" : "5700"}.
                  </div>
                ) : (
                  <select
                    className={styles.accountSelect}
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                  >
                    <option value="">-- Seleccionar cuenta --</option>
                    {filteredCuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.banco} ({c.cuenta_contable}){c.iban ? ` - ${c.iban}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* PASO 2 */}
          <div className={styles.step}>
            <div className={styles.selectionWrapper}>
              <label className={styles.fieldLabel}>Seleccionar Viajeros y/o Clientes:</label>

              <div className={styles.selectionTrigger} onClick={() => setIsDropdownOpen((prev) => !prev)}>
                {selectedViajerosIds.length === 0 && selectedClientesIds.length === 0 ? (
                  <span className={styles.selectionPlaceholder}>Haga clic para buscar y seleccionar...</span>
                ) : (
                  <>
                    {selectedViajerosIds.map((vid) => {
                      const name = listViajeros.find((x) => x.id === vid)?.nombre || "Viajero";
                      return (
                        <div
                          key={vid}
                          className={`${styles.chip} ${styles.chipViajero}`}
                          onClick={(e) => { e.stopPropagation(); toggleViajeroSelection(vid); }}
                        >
                          <span>{name} (Viajero)</span>
                          <span className={styles.chipRemove}>×</span>
                        </div>
                      );
                    })}
                    {selectedClientesIds.map((cid) => {
                      const name = listClientes.find((x) => x.id === cid)?.nombre || "Cliente";
                      return (
                        <div
                          key={cid}
                          className={`${styles.chip} ${styles.chipCliente}`}
                          onClick={(e) => { e.stopPropagation(); toggleClienteSelection(cid); }}
                        >
                          <span>{name} (Cliente)</span>
                          <span className={styles.chipRemove}>×</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {isDropdownOpen && (
                <>
                  <div className={styles.dropdownOverlay} onClick={() => setIsDropdownOpen(false)} />
                  <div className={styles.dropdown}>
                    <div className={styles.dropdownSearchRow}>
                      <Icons.Search size={14} style={{ color: "#94a3b8" }} />
                      <input
                        type="text"
                        placeholder="Buscar por nombre o documento..."
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        className={styles.dropdownSearchInput}
                        autoFocus
                      />
                      {dropdownSearch && (
                        <button className={styles.dropdownClearBtn} onClick={() => setDropdownSearch("")}>
                          <Icons.Close size={12} />
                        </button>
                      )}
                    </div>
                    <div className={styles.dropdownList}>
                      <div className={styles.dropdownSectionHeader}>
                        Viajeros ({filteredListViajeros.length})
                      </div>
                      {filteredListViajeros.length === 0 ? (
                        <div className={styles.dropdownEmpty}>No hay viajeros que coincidan</div>
                      ) : (
                        filteredListViajeros.map((v) => {
                          const isChecked = selectedViajerosIds.includes(v.id);
                          return (
                            <div
                              key={v.id}
                              className={`${styles.dropdownItem} ${isChecked ? styles.selected : ""}`}
                              onClick={() => toggleViajeroSelection(v.id)}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                style={{ accentColor: "var(--primary-color, #475569)", cursor: "pointer" }}
                              />
                              <div>
                                <div className={styles.dropdownItemName}>{v.nombre}</div>
                                <div className={styles.dropdownItemSub}>Pagador: {v.pagadorNombre}</div>
                              </div>
                            </div>
                          );
                        })
                      )}

                      <div className={styles.dropdownDivider} />

                      <div className={styles.dropdownSectionHeader}>
                        Clientes / Pagadores ({filteredListClientes.length})
                      </div>
                      {filteredListClientes.length === 0 ? (
                        <div className={styles.dropdownEmpty}>No hay clientes que coincidan</div>
                      ) : (
                        filteredListClientes.map((c) => {
                          const isChecked = selectedClientesIds.includes(c.id);
                          return (
                            <div
                              key={c.id}
                              className={`${styles.dropdownItem} ${isChecked ? styles.selected : ""}`}
                              onClick={() => toggleClienteSelection(c.id)}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                style={{ accentColor: "var(--primary-color, #475569)", cursor: "pointer" }}
                              />
                              <div>
                                <div className={styles.dropdownItemName}>{c.nombre}</div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {(selectedViajerosIds.length > 0 || selectedClientesIds.length > 0) && (
              <div className={styles.amountSection}>
                {metodoCobro === "tarjeta" && (
                  <div className={styles.tpvGroup}>
                    <label className={styles.fieldLabel}>Nº Tique TPV (opcional):</label>
                    <input
                      type="text"
                      placeholder="Ej: 1234"
                      value={tiqueTPV}
                      onChange={(e) => setTiqueTPV(e.target.value)}
                      disabled={isSubmitting}
                      className={styles.textInput}
                    />
                  </div>
                )}
                <label className={styles.fieldLabel}>Importe a cobrar (€):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Introduce el importe, ej: 150.00"
                  value={importeCobro}
                  onChange={(e) => setImporteCobro(e.target.value)}
                  disabled={isSubmitting}
                  className={styles.textInput}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {modalStep === 1 ? (
            <>
              <button className={styles.btnSecondary} onClick={handleClose}>
                Cancelar
              </button>
              <button className={styles.btnPrimary} onClick={() => setModalStep(2)} disabled={!canProceed}>
                Siguiente
              </button>
            </>
          ) : (
            <>
              <button
                className={styles.btnSecondary}
                disabled={isSubmitting}
                onClick={() => { setModalStep(1); setImporteCobro(""); }}
              >
                Atrás
              </button>
              <button className={styles.btnPrimary} onClick={handleConfirmar} disabled={!canConfirm}>
                {isSubmitting && (
                  <Icons.RefreshCw size={14} style={{ animation: "cobroSpin 1s linear infinite" }} />
                )}
                {isSubmitting ? "Confirmando..." : "Confirmar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

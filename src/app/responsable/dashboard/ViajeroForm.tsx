"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { validarDNI } from "@/lib/validaciones";
import {
  upsertViajeroResponsable,
  getDocumentosViajeroResponsable,
  subirDocumentoResponsable,
  type ResponsableViajero,
  type ResponsableDocumento,
} from "@/actions/responsable";

interface Props {
  viajero: ResponsableViajero | null;
  onClose: () => void;
  onSaved: (viajero: ResponsableViajero) => void;
}

export default function ViajeroForm({ viajero, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(viajero?.nombre ?? "");
  const [apellidos, setApellidos] = useState(viajero?.apellidos ?? "");
  const [documento, setDocumento] = useState(viajero?.documento ?? "");
  const [email, setEmail] = useState(viajero?.email ?? "");
  const [telefono, setTelefono] = useState(viajero?.telefono ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [documentos, setDocumentos] = useState<ResponsableDocumento[]>([]);
  const [tipoDoc, setTipoDoc] = useState<"dni" | "pasaporte" | "otro">("dni");
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    if (viajero?.id) {
      getDocumentosViajeroResponsable(viajero.id).then(setDocumentos);
    }
  }, [viajero?.id]);

  async function handleSave() {
    setError(null);
    if (!nombre.trim() || !apellidos.trim()) {
      setError("Nombre y apellidos son obligatorios");
      return;
    }
    if (!documento.trim()) {
      setError("El documento (DNI/pasaporte) es obligatorio");
      return;
    }
    if (/^\d{8}[A-Z]$/i.test(documento.trim()) && !validarDNI(documento)) {
      setError("El DNI no es válido");
      return;
    }

    setSaving(true);
    const result = await upsertViajeroResponsable({
      viajeroExpedienteId: viajero?.id,
      nombre: nombre.trim(),
      apellidos: apellidos.trim(),
      documento: documento.trim(),
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      extras: viajero?.extras.map((e) => ({ id: e.id, nombre: e.descripcion, pvp: e.precio, cantidad: e.cantidad })) ?? [],
    });
    setSaving(false);

    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }

    onSaved({
      id: (result as any).viajeroExpedienteId ?? viajero?.id ?? "",
      entidadId: viajero?.entidadId ?? "",
      nombre: nombre.trim(),
      apellidos: apellidos.trim(),
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      documento: documento.trim(),
      estado: viajero?.estado ?? "pendiente",
      extras: viajero?.extras ?? [],
      importeExtras: viajero?.importeExtras ?? 0,
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !viajero?.id) return;

    setSubiendo(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const result = await subirDocumentoResponsable({
        viajeroExpedienteId: viajero.id,
        tipoDocumento: tipoDoc,
        base64,
        mimeType: file.type,
        nombreOriginal: file.name,
      });
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        const docs = await getDocumentosViajeroResponsable(viajero.id);
        setDocumentos(docs);
      }
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{viajero ? "Editar viajero" : "Añadir viajero"}</h2>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.formGrid}>
          <div>
            <label className={styles.label}>Nombre</label>
            <input className={styles.input} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <label className={styles.label}>Apellidos</label>
            <input className={styles.input} value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
          </div>
          <div className={styles.fullWidth}>
            <label className={styles.label}>DNI / Pasaporte</label>
            <input className={styles.input} value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </div>
          <div>
            <label className={styles.label}>Email</label>
            <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={styles.label}>Teléfono</label>
            <input className={styles.input} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
        </div>

        {viajero && (
          <div className={styles.fullWidth} style={{ marginTop: "1.25rem" }}>
            <label className={styles.label}>Documentación</label>
            <div className={styles.docList}>
              {documentos.length === 0 && <span className={styles.viajeroMeta}>Sin documentos subidos</span>}
              {documentos.map((d) => (
                <div key={d.id} className={styles.docRow}>
                  <span>
                    {d.tipoDocumento} — {d.nombreOriginal || "archivo"}
                  </span>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
                    Ver
                  </a>
                </div>
              ))}
            </div>
            <div className={styles.uploadRow}>
              <select className={styles.select} value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value as any)}>
                <option value="dni">DNI</option>
                <option value="pasaporte">Pasaporte</option>
                <option value="otro">Otro</option>
              </select>
              <input type="file" accept="image/png,image/jpeg,application/pdf" onChange={handleUpload} disabled={subiendo} />
            </div>
          </div>
        )}

        <div className={styles.modalActions}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancelar
          </button>
          <button className={styles.saveButton} onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

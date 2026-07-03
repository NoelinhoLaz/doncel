"use client";

import React, { useState, useEffect } from "react";
import { X, BookOpen } from "lucide-react";
import styles from "../../page.module.css";
import { VARIABLES_PROPUESTA } from "../../utils/text-formatting";
import { getDatosRealesPropuesta } from "@/actions/propuestas";

const FORMATOS = [
  { sintaxis: "**texto**", descripcion: "Negrita" },
  { sintaxis: ".- texto", descripcion: "Viñeta / lista" },
  { sintaxis: "[texto](url)", descripcion: "Enlace" },
  { sintaxis: "Línea vacía", descripcion: "Párrafo / espaciado" },
];

export function GuiaFormato({
  cotizacionId,
  propuestaId,
}: {
  cotizacionId?: string | null;
  propuestaId?: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [variablesValues, setVariablesValues] = useState<Record<string, string>>(VARIABLES_PROPUESTA);

  useEffect(() => {
    async function loadRealData() {
      try {
        const res = await getDatosRealesPropuesta({ propuestaId, cotizacionId });
        if (res.ok && res.data) {
          setVariablesValues(res.data);
        }
      } catch (err) {
        console.error("Error loading real variables data:", err);
      }
    }
    loadRealData();
  }, [propuestaId, cotizacionId]);

  const variablesList = Object.entries(variablesValues).map(([variable, ejemplo]) => ({
    variable,
    ejemplo,
  }));

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={styles.guiaFormatoBtn}
      >
        <BookOpen size={12} />
        Guía de formato
      </button>

      {abierto && (
        <div className={styles.guiaOverlay} onClick={() => setAbierto(false)}>
          <div className={styles.guiaModal} onClick={e => e.stopPropagation()}>
            <div className={styles.guiaHeader}>
              <span className={styles.guiaTitle}>
                <BookOpen size={14} />
                Guía de formato
              </span>
              <button className={styles.guiaClose} onClick={() => setAbierto(false)}>
                <X size={14} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Sección superior: formatos */}
              <div className={styles.guiaCol}>
                <p className={styles.guiaColTitle}>Formatos de texto</p>
                <p className={styles.guiaColSubtitle}>Se renderiza en la previsualización, no en el editor.</p>
                <table className={styles.guiaTable}>
                  <tbody>
                    {FORMATOS.map(f => (
                      <tr key={f.sintaxis}>
                        <td>
                          <code className={styles.guiaCode}>{f.sintaxis}</code>
                        </td>
                        <td className={styles.guiaDesc}>{f.descripcion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sección inferior: variables */}
              <div className={styles.guiaCol} style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                <p className={styles.guiaColTitle}>Variables / Etiquetas</p>
                <p className={styles.guiaColSubtitle}>Se sustituyen con los datos de la propuesta.</p>
                <table className={styles.guiaTable}>
                  <tbody>
                    {variablesList.map(v => (
                      <tr key={v.variable}>
                        <td>
                          <code className={styles.guiaCode}>{v.variable}</code>
                        </td>
                        <td className={styles.guiaDesc} style={{ color: "#94a3b8", fontStyle: "italic" }}>{v.ejemplo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

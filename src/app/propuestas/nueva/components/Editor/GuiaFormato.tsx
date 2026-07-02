"use client";

import React from "react";
import { X, BookOpen } from "lucide-react";
import styles from "../../page.module.css";

const FORMATOS = [
  { sintaxis: "**texto**", descripcion: "Negrita", ejemplo: "Viaje a **París** en primavera" },
  { sintaxis: ".- texto", descripcion: "Viñeta / lista", ejemplo: ".- Traslados incluidos" },
  { sintaxis: "[texto](url)", descripcion: "Enlace", ejemplo: "[Ver hotel](https://hotel.com)" },
  { sintaxis: "Línea vacía", descripcion: "Párrafo / espaciado", ejemplo: "Línea 1\n\nLínea 2" },
];

const VARIABLES = [
  { variable: "[Nombre_Cliente]", descripcion: "Nombre del cliente" },
  { variable: "[Apellidos_Cliente]", descripcion: "Apellidos del cliente" },
  { variable: "[Nombre_Responsable]", descripcion: "Nombre del agente responsable" },
  { variable: "[Fecha_Salida]", descripcion: "Fecha de inicio del viaje" },
  { variable: "[Fecha_Vuelta]", descripcion: "Fecha de regreso" },
  { variable: "[Destino]", descripcion: "Destino principal" },
  { variable: "[Num_Viajeros]", descripcion: "Número de viajeros" },
  { variable: "[Num_Noches]", descripcion: "Número de noches" },
  { variable: "[Precio_Total]", descripcion: "Precio total de la propuesta" },
  { variable: "[Precio_Por_Persona]", descripcion: "Precio por persona" },
];

export function GuiaFormato() {
  const [abierto, setAbierto] = React.useState(false);

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

            <div className={styles.guiaCols}>
              {/* Columna izquierda: formatos */}
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

              {/* Columna derecha: variables */}
              <div className={styles.guiaCol}>
                <p className={styles.guiaColTitle}>Variables / Etiquetas</p>
                <p className={styles.guiaColSubtitle}>Se sustituyen con los datos de la propuesta.</p>
                <table className={styles.guiaTable}>
                  <tbody>
                    {VARIABLES.map(v => (
                      <tr key={v.variable}>
                        <td>
                          <code className={styles.guiaCode}>{v.variable}</code>
                        </td>
                        <td className={styles.guiaDesc}>{v.descripcion}</td>
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

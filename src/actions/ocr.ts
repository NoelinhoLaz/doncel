"use server";

import { getAnthropicClient } from "@/lib/anthropic";
import { getAgencyDbClientByDomain } from "@/lib/agencyDb";

export interface OcrResultado {
  tipoDoc: "dni" | "pasaporte";
  nombre: string;
  apellidos: string;
  numeroDoc: string;
  fechaNacimiento: string;   // YYYY-MM-DD
  fechaCaducidad: string;    // YYYY-MM-DD
  // Campos adicionales capturados para log/debug
  sexo?: string;             // M o F tal cual aparece en el documento
  numeroSoporte?: string;    // Número de soporte del DNI (ej: AAA123456)
  nacionalidad?: string;     // Código ISO (ej: ESP)
  lugarNacimiento?: string;
  domicilio?: string;
  pais?: string;
  mrzLinea1?: string;        // MRZ completa para auditoría
  mrzLinea2?: string;
}

export async function extraerDatosDocumento(
  base64: string,
  mimeType: string,
  domain: string
): Promise<OcrResultado> {
  const agency = await getAgencyDbClientByDomain(domain);
  const agenciaId = agency?.agenciaId ?? "";
  const client = await getAnthropicClient(agenciaId);

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: base64 },
          },
          {
            type: "text",
            text: `Extrae TODOS los datos visibles de este documento de identidad español (DNI o pasaporte).
Responde ÚNICAMENTE con un JSON válido con esta estructura exacta, sin texto adicional:
{
  "tipoDoc": "dni" o "pasaporte",
  "nombre": "nombre de pila completo (puede ser compuesto, ej: MARIA JOSE, ANA BELEN)",
  "apellidos": "apellido1 apellido2 (ambos apellidos, cada uno puede ser compuesto)",
  "numeroDoc": "número completo con letra (ej: 12345678Z)",
  "fechaNacimiento": "YYYY-MM-DD",
  "fechaCaducidad": "YYYY-MM-DD",
  "sexo": "M" o "F" (tal como aparece en el documento),
  "numeroSoporte": "código de soporte del DNI, formato 3 letras + 6 alfanuméricos (ej: AAA123456), solo en DNI",
  "nacionalidad": "código de 3 letras (ej: ESP)",
  "lugarNacimiento": "ciudad o municipio si aparece",
  "domicilio": "dirección completa si aparece",
  "pais": "país emisor si aparece",
  "mrzLinea1": "primera línea MRZ completa si es visible",
  "mrzLinea2": "segunda línea MRZ completa si es visible"
}

Notas importantes:
- Si no puedes leer algún campo con certeza, devuelve cadena vacía "" para ese campo.
- NOMBRE: en el DNI español aparece bajo la etiqueta "NOMBRE". Cópialo completo tal cual aparece, incluyendo todos los nombres si son compuestos (ej: "MARIA JOSE", "ANA ISABEL", "JUAN CARLOS").
- APELLIDOS: en el DNI aparecen bajo "APELLIDOS" en una o dos líneas. Incluye ambos apellidos separados por espacio.
- Para el DNI español: el número son 8 dígitos + 1 letra. Si ves 9 dígitos, los primeros 8 son el número y la letra se calcula con módulo 23 usando la tabla TRWAGMYFPDXBNJZSQVHLCKE.
- El número de soporte (IDESP) aparece en el reverso del DNI, generalmente en la zona MRZ o impreso en el anverso. Formato típico: 3 letras mayúsculas + 6 dígitos/letras (ej: AAA123456, BCA987654).
- El sexo aparece como "M" (Masculino) o "F" (Femenino) en el documento.
- Extrae la MRZ completa si es visible, es muy útil para validación.`,
          },
        ],
      },
    ],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text.trim();

  // Log completo de todo lo que extrae el OCR
  console.log("=== OCR RAW RESPONSE ===");
  console.log(raw);

  const jsonStr = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
  const datos = JSON.parse(jsonStr) as OcrResultado;

  console.log("=== OCR DATOS PARSEADOS ===");
  console.log(JSON.stringify(datos, null, 2));

  // Normaliza el número DNI si viene sin letra
  if (datos.tipoDoc === "dni" && /^\d{8}$/.test(datos.numeroDoc)) {
    const LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";
    datos.numeroDoc += LETRAS[parseInt(datos.numeroDoc, 10) % 23];
  }

  // Normaliza sexo a M/F
  if (datos.sexo) {
    datos.sexo = datos.sexo.trim().toUpperCase().startsWith("M") ? "M" : "F";
  }

  // Normaliza número de soporte a mayúsculas sin espacios
  if (datos.numeroSoporte) {
    datos.numeroSoporte = datos.numeroSoporte.trim().toUpperCase().replace(/\s/g, "");
  }

  return datos;
}

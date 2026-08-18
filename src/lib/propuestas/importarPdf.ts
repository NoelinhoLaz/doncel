import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";
import { getAgencyDbClient, getCurrentSchemaName, bucketNameForSchema } from "@/lib/agencyDb";
import { extraerImagenesPdf } from "./extraerImagenesPdf";
import { extraerContenidoDocx } from "./extraerContenidoDocx";

export class ImportarPropuestaError extends Error {
  codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
  }
}

async function getAgenciaIdFromSession(): Promise<string> {
  const adminSupabase = await createAdminServerClient();
  const { data: { user }, error: userError } = await adminSupabase.auth.getUser();
  if (userError || !user) {
    throw new ImportarPropuestaError("AGENT_SESSION_ERROR", "No hay usuario autenticado");
  }

  const adminServiceSupabase = createAdminServiceClient();
  const { data: usuario, error: usuarioError } = await adminServiceSupabase
    .from("usuarios")
    .select("agencia_id")
    .eq("auth_user_id", user.id)
    .single();

  if (usuarioError || !usuario?.agencia_id) {
    throw new ImportarPropuestaError("AGENT_SESSION_ERROR", "Agencia no encontrada para el usuario");
  }

  return usuario.agencia_id;
}

const SYSTEM_PROMPT = `Lee el PDF de una propuesta de viaje y devuelve SOLO un array JSON de secciones (sin markdown, sin texto extra) en este formato de editor:

1. "portada" (siempre primera): titulo, subtitulo (grupo/colegio/cliente si aplica).
2. "itinerario" (si hay día a día): titulo, fechaDesde/fechaHasta ("YYYY-MM-DD"), dias: [{ dia, titulo (resumen corto), desc (texto completo del día), paginaPdf (number, 1-indexado: en qué página del PDF está el texto de ese día) }].
3. "texto-columnas" (para "el precio incluye" y para contenido de texto adicional): titulo, columnas: [{ titulo, texto }]. Para "el precio incluye" usa una sola columna con titulo "Incluye" y texto en HTML de lista con viñetas: "<ul><li>servicio 1</li><li>servicio 2</li></ul>", un <li> por cada servicio incluido.
4. "precio" (si hay precio/condiciones/observaciones): pvp, condiciones (pagos, con "\\n" entre puntos), otrasConsideraciones (lo que no incluye + observaciones + cuenta bancaria, con "\\n" entre puntos).

Reglas: no inventes datos ausentes (omite el campo); fechas del itinerario coherentes con el rango del viaje; ignora cabecera/pie repetitivo del agente (nombre, email, dirección).`;

export interface SeccionImportada {
  tipo: string;
  titulo?: string;
  subtitulo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  dias?: { dia: number; titulo?: string; desc?: string; paginaPdf?: number; marcadorImg?: number; media?: { tipo: "upload"; url: string } }[];
  cards?: { titulo: string }[];
  pvp?: string;
  condiciones?: string;
  otrasConsideraciones?: string;
  columnas?: { titulo?: string; texto?: string }[];
}

export interface ResultadoImportacionPdf {
  secciones: SeccionImportada[];
  tokens: { input: number; output: number; coste_usd: number };
}

export async function subirImagenExtraida(buffer: Buffer, uid: string): Promise<string> {
  const agencyDb = await getAgencyDbClient();
  const bucket = bucketNameForSchema("propuestas-media", await getCurrentSchemaName());
  const path = `propuestas/pdf-import-${uid}-${Date.now()}.png`;

  const { error: bucketErr } = await agencyDb.storage.createBucket(bucket, {
    public: true,
    allowedMimeTypes: ["image/*"],
    fileSizeLimit: 10 * 1024 * 1024,
  });
  if (bucketErr && !bucketErr.message.includes("already exists") && !bucketErr.message.includes("Duplicate")) {
    throw bucketErr;
  }

  const { error } = await agencyDb.storage
    .from(bucket)
    .upload(path, buffer, { contentType: "image/png", upsert: false });
  if (error) throw error;

  const { data: urlData } = agencyDb.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
}

export async function extraerSeccionesDesdeePdf(file: File): Promise<ResultadoImportacionPdf> {
  if (file.type !== "application/pdf") {
    throw new ImportarPropuestaError("PDF_INVALIDO", "El archivo debe ser PDF");
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new ImportarPropuestaError("PDF_INVALIDO", "El archivo supera 50 MB");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64PDF = buffer.toString("base64");

  const agenciaId = await getAgenciaIdFromSession();
  const anthropic = await getAnthropicClient(agenciaId, "Anthropic Claude");

  let respuesta: any;
  try {
    respuesta = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64PDF },
            },
            {
              type: "text",
              text: "Extrae las secciones de esta propuesta de viaje siguiendo las instrucciones del sistema.",
            },
          ],
        },
      ],
    });
  } catch (e: any) {
    throw new ImportarPropuestaError("AI_API_ERROR", e.message);
  }

  const tokensInput = respuesta.usage?.input_tokens ?? 0;
  const tokensOutput = respuesta.usage?.output_tokens ?? 0;
  const costeUsd = tokensInput * 0.000001 + tokensOutput * 0.000005;

  const textoRaw = respuesta.content[0]?.text;
  if (!textoRaw) {
    throw new ImportarPropuestaError("JSON_PARSE_ERROR", "La respuesta del modelo está vacía");
  }

  const textoLimpio = textoRaw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let secciones: SeccionImportada[];
  try {
    secciones = JSON.parse(textoLimpio);
    if (!Array.isArray(secciones)) throw new Error("No es un array");
  } catch {
    console.error("RESPUESTA RAW:", textoRaw.slice(0, 1000));
    throw new ImportarPropuestaError("JSON_PARSE_ERROR", "No se pudo interpretar la respuesta del modelo");
  }

  // Extrae las imágenes embebidas del PDF y las asocia a cada día del itinerario
  // por la página en la que Claude detectó su texto.
  try {
    const imagenes = await extraerImagenesPdf(buffer);
    if (imagenes.length > 0) {
      const itinerario = secciones.find(s => s.tipo === "itinerario");
      if (itinerario?.dias) {
        for (const dia of itinerario.dias) {
          if (!dia.paginaPdf) continue;
          const imgPagina = imagenes.find(img => img.pagina === dia.paginaPdf);
          if (imgPagina) {
            const url = await subirImagenExtraida(imgPagina.buffer, `dia${dia.dia}`);
            dia.media = { tipo: "upload", url };
          }
        }
      }
    }
  } catch (e: any) {
    console.warn("No se pudieron extraer/subir imágenes del PDF:", e?.message);
  }

  return {
    secciones,
    tokens: { input: tokensInput, output: tokensOutput, coste_usd: costeUsd },
  };
}

const SYSTEM_PROMPT_WORD = `Lee el texto de una propuesta de viaje (extraído de un Word) y devuelve SOLO un array JSON de secciones (sin markdown, sin texto extra) en este formato de editor:

1. "portada" (siempre primera): titulo, subtitulo (grupo/colegio/cliente si aplica).
2. "itinerario" (si hay día a día): titulo, fechaDesde/fechaHasta ("YYYY-MM-DD"), dias: [{ dia, titulo (resumen corto), desc (texto completo del día), marcadorImg (number: el N del marcador "[IMG:N]" más cercano al texto de ese día, si hay alguno cerca) }].
3. "texto-columnas" (para "el precio incluye" y para contenido de texto adicional): titulo, columnas: [{ titulo, texto }]. Para "el precio incluye" usa una sola columna con titulo "Incluye" y texto en HTML de lista con viñetas: "<ul><li>servicio 1</li><li>servicio 2</li></ul>", un <li> por cada servicio incluido.
4. "precio" (si hay precio/condiciones/observaciones): pvp, condiciones (pagos, con "\\n" entre puntos), otrasConsideraciones (lo que no incluye + observaciones + cuenta bancaria, con "\\n" entre puntos).

El texto incluye marcadores "[IMG:N]" en el punto exacto donde había una imagen en el documento original — úsalos solo para decidir "marcadorImg" de cada día, no los copies en ningún campo de texto.

Reglas: no inventes datos ausentes (omite el campo); fechas del itinerario coherentes con el rango del viaje; ignora cabecera/pie repetitivo del agente (nombre, email, dirección).`;

export async function extraerSeccionesDesdeWord(file: File): Promise<ResultadoImportacionPdf> {
  const esWord =
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx");
  if (!esWord) {
    throw new ImportarPropuestaError("WORD_INVALIDO", "El archivo debe ser Word (.docx)");
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new ImportarPropuestaError("WORD_INVALIDO", "El archivo supera 50 MB");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let textoConMarcadores: string;
  let imagenesDocx: Awaited<ReturnType<typeof extraerContenidoDocx>>["imagenes"];
  try {
    const contenido = await extraerContenidoDocx(buffer);
    textoConMarcadores = contenido.textoConMarcadores;
    imagenesDocx = contenido.imagenes;
  } catch (e: any) {
    throw new ImportarPropuestaError("WORD_PARSE_ERROR", "No se pudo leer el documento Word: " + e.message);
  }

  if (!textoConMarcadores.trim()) {
    throw new ImportarPropuestaError("WORD_INVALIDO", "El documento Word está vacío o no contiene texto legible");
  }

  const agenciaId = await getAgenciaIdFromSession();
  const anthropic = await getAnthropicClient(agenciaId, "Anthropic Claude");

  let respuesta: any;
  try {
    respuesta = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      system: SYSTEM_PROMPT_WORD,
      messages: [
        {
          role: "user",
          content: `Extrae las secciones de esta propuesta de viaje siguiendo las instrucciones del sistema:\n\n${textoConMarcadores}`,
        },
      ],
    });
  } catch (e: any) {
    throw new ImportarPropuestaError("AI_API_ERROR", e.message);
  }

  const tokensInput = respuesta.usage?.input_tokens ?? 0;
  const tokensOutput = respuesta.usage?.output_tokens ?? 0;
  const costeUsd = tokensInput * 0.000001 + tokensOutput * 0.000005;

  const textoRaw = respuesta.content[0]?.text;
  if (!textoRaw) {
    throw new ImportarPropuestaError("JSON_PARSE_ERROR", "La respuesta del modelo está vacía");
  }

  const textoLimpio = textoRaw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let secciones: SeccionImportada[];
  try {
    secciones = JSON.parse(textoLimpio);
    if (!Array.isArray(secciones)) throw new Error("No es un array");
  } catch {
    console.error("RESPUESTA RAW:", textoRaw.slice(0, 1000));
    throw new ImportarPropuestaError("JSON_PARSE_ERROR", "No se pudo interpretar la respuesta del modelo");
  }

  // Sube las imágenes embebidas del Word y las asocia a cada día del itinerario
  // por el marcador "[IMG:N]" que Claude detectó más cercano al texto de ese día.
  try {
    if (imagenesDocx.length > 0) {
      const itinerario = secciones.find(s => s.tipo === "itinerario");
      if (itinerario?.dias) {
        for (const dia of itinerario.dias) {
          if (dia.marcadorImg === undefined) continue;
          const img = imagenesDocx.find(i => i.indice === dia.marcadorImg);
          if (img) {
            const url = await subirImagenExtraida(img.buffer, `dia${dia.dia}`);
            dia.media = { tipo: "upload", url };
          }
        }
      }
    }
  } catch (e: any) {
    console.warn("No se pudieron extraer/subir imágenes del Word:", e?.message);
  }

  return {
    secciones,
    tokens: { input: tokensInput, output: tokensOutput, coste_usd: costeUsd },
  };
}

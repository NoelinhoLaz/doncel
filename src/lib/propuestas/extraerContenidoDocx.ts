import mammoth from "mammoth";

export interface ImagenDocx {
  indice: number;
  buffer: Buffer;
  contentType: string;
}

export interface ContenidoDocx {
  /** Texto plano del documento con marcadores "[IMG:N]" en el punto donde aparecía cada imagen. */
  textoConMarcadores: string;
  imagenes: ImagenDocx[];
}

/**
 * Convierte un .docx a texto plano, capturando las imágenes embebidas como buffers
 * (en vez de inline base64) y dejando un marcador "[IMG:N]" en el texto en el punto
 * exacto donde aparecía cada imagen — así se puede asociar cada imagen a la sección/día
 * de texto más cercano sin depender de páginas (el concepto de "página" no existe en Word).
 */
export async function extraerContenidoDocx(buffer: Buffer): Promise<ContenidoDocx> {
  const imagenes: ImagenDocx[] = [];

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement((image) =>
        image.read().then((imgBuffer) => {
          const indice = imagenes.length;
          imagenes.push({ indice, buffer: imgBuffer, contentType: image.contentType });
          return { src: `IMGMARK_${indice}` };
        })
      ),
    }
  );

  const textoConMarcadores = result.value
    .replace(/<img[^>]*src="IMGMARK_(\d+)"[^>]*>/g, "[IMG:$1]")
    .replace(/<\/p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { textoConMarcadores, imagenes };
}

import sharp from "sharp";

/**
 * Extrae las imágenes embebidas de un PDF (una por página, aprox. la más grande
 * de cada página) usando pdfjs-dist para acceder a los objetos XObject de imagen,
 * y las devuelve como PNGs listos para subir a Storage.
 *
 * No renderiza/rasteriza la página entera — recupera los bytes de imagen originales
 * embebidos en el PDF, igual que haría un usuario que las extrajera manualmente.
 */
export interface ImagenExtraidaPdf {
  pagina: number;
  buffer: Buffer;
}

export async function extraerImagenesPdf(pdfBuffer: Buffer): Promise<ImagenExtraidaPdf[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;

  const resultado: ImagenExtraidaPdf[] = [];

  for (let numPagina = 1; numPagina <= doc.numPages; numPagina++) {
    const page = await doc.getPage(numPagina);
    const opList = await page.getOperatorList();

    let mejorImagen: { width: number; height: number; data: Uint8ClampedArray | Uint8Array } | null = null;

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      if (fn !== pdfjs.OPS.paintImageXObject && fn !== pdfjs.OPS.paintInlineImageXObject) continue;

      const args = opList.argsArray[i];
      const imgName = args?.[0];
      if (!imgName) continue;

      try {
        const img: any = await new Promise((resolve, reject) => {
          page.objs.get(imgName, (obj: any) => resolve(obj));
          setTimeout(() => reject(new Error("timeout")), 5000);
        });
        if (!img?.data || !img.width || !img.height) continue;

        // Nos quedamos con la imagen más grande de la página (probablemente la foto principal)
        const area = img.width * img.height;
        if (!mejorImagen || area > mejorImagen.width * mejorImagen.height) {
          mejorImagen = { width: img.width, height: img.height, data: img.data };
        }
      } catch {
        continue;
      }
    }

    if (mejorImagen) {
      try {
        const channels = mejorImagen.data.length / (mejorImagen.width * mejorImagen.height);
        const png = await sharp(Buffer.from(mejorImagen.data), {
          raw: { width: mejorImagen.width, height: mejorImagen.height, channels: (channels === 4 ? 4 : channels === 1 ? 1 : 3) as 1 | 3 | 4 },
        })
          .png()
          .toBuffer();
        // Descarta imágenes minúsculas (probablemente logos/iconos de cabecera, no fotos)
        if (mejorImagen.width >= 200 && mejorImagen.height >= 150) {
          resultado.push({ pagina: numPagina, buffer: png });
        }
      } catch {
        // Si sharp no puede interpretar el raw (formato de color no estándar), se omite esa página
      }
    }
  }

  return resultado;
}

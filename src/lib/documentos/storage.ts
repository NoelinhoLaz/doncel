import { getAgencyDbClient } from '@/lib/agencyDb'

/**
 * Sube un PDF al bucket 'documentos-proveedor' y devuelve
 * { archivo_url, archivo_path }.
 * La URL firmada tiene validez de 1 año.
 */
export async function subirPDF(
  buffer: Buffer,
  uuid: string,
  nombreOriginal: string
): Promise<{ archivo_url: string; archivo_path: string }> {
  const agencyDb = await getAgencyDbClient()
  const ahora = new Date()
  const año   = ahora.getFullYear()
  const mes   = String(ahora.getMonth() + 1).padStart(2, '0')
  const path  = `${año}/${mes}/${uuid}.pdf`

  const { error } = await agencyDb.storage
    .from('documentos-proveedor')
    .upload(path, buffer, {
      contentType: 'application/pdf',
      upsert:      false
    })

  if (error) throw new Error(`STORAGE_ERROR: ${error.message}`)

  const { data: signedData } = await agencyDb.storage
    .from('documentos-proveedor')
    .createSignedUrl(path, 60 * 60 * 24 * 365) // 1 año

  return {
    archivo_url:  signedData?.signedUrl ?? '',
    archivo_path: path
  }
}

/**
 * Sube el JSON de extracción al bucket 'extracciones-ia'.
 * Usa upsert para permitir sobreescritura en reprocesado.
 * Devuelve la URL firmada con validez de 1 año.
 */
export async function subirExtraccion(
  json: unknown,
  documentoId: string,
  version: number
): Promise<string> {
  const agencyDb = await getAgencyDbClient()
  const ahora  = new Date()
  const año    = ahora.getFullYear()
  const mes    = String(ahora.getMonth() + 1).padStart(2, '0')
  const path   = `${año}/${mes}/${documentoId}_v${version}.json`
  const buffer = Buffer.from(JSON.stringify(json, null, 2))

  const { error } = await agencyDb.storage
    .from('extracciones-ia')
    .upload(path, buffer, {
      contentType: 'application/json',
      upsert:      true
    })

  if (error) throw new Error(`STORAGE_ERROR: ${error.message}`)

  const { data } = await agencyDb.storage
    .from('extracciones-ia')
    .createSignedUrl(path, 60 * 60 * 24 * 365)

  return data?.signedUrl ?? ''
}


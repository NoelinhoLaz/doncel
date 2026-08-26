import { getAgencyDbClient, getCurrentSchemaName, bucketNameForSchema } from '@/lib/agencyDb'
import type { SupabaseClient } from '@supabase/supabase-js'

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
  const bucket = bucketNameForSchema('documentos-proveedor', await getCurrentSchemaName())
  const ahora = new Date()
  const año   = ahora.getFullYear()
  const mes   = String(ahora.getMonth() + 1).padStart(2, '0')
  const path  = `${año}/${mes}/${uuid}.pdf`

  const { error } = await agencyDb.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: 'application/pdf',
      upsert:      false
    })

  if (error) throw new Error(`STORAGE_ERROR: ${error.message}`)

  const { data: signedData } = await agencyDb.storage
    .from(bucket)
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
  const bucket = bucketNameForSchema('extracciones-ia', await getCurrentSchemaName())
  const ahora  = new Date()
  const año    = ahora.getFullYear()
  const mes    = String(ahora.getMonth() + 1).padStart(2, '0')
  const path   = `${año}/${mes}/${documentoId}_v${version}.json`
  const buffer = Buffer.from(JSON.stringify(json, null, 2))

  const { error } = await agencyDb.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: 'application/json',
      upsert:      true
    })

  if (error) throw new Error(`STORAGE_ERROR: ${error.message}`)

  const { data } = await agencyDb.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60 * 24 * 365)

  return data?.signedUrl ?? ''
}

/**
 * Sube un documento de viajero (DNI/pasaporte) a un bucket privado
 * namespaced por schema. No devuelve URL — solo el path guardado; la
 * visualización se hace con signed URLs de vida corta generadas al vuelo.
 */
export async function subirDocumentoViajero(
  db: SupabaseClient<any, any, any>,
  schemaName: string,
  buffer: Buffer,
  contentType: string,
  viajeroExpedienteId: string,
  tipoDocumento: 'dni' | 'pasaporte' | 'otro',
  extension: string
): Promise<{ storage_path: string }> {
  const bucket = bucketNameForSchema('documentos-viajero', schemaName)
  const path = `${viajeroExpedienteId}/${tipoDocumento}-${Date.now()}.${extension}`

  await db.storage.createBucket(bucket, { public: false, fileSizeLimit: 10 * 1024 * 1024 }).catch(() => {})

  const { error } = await db.storage.from(bucket).upload(path, buffer, { contentType, upsert: true })
  if (error) throw new Error(`STORAGE_ERROR: ${error.message}`)

  return { storage_path: path }
}

/**
 * Genera una signed URL de vida corta para un documento de viajero.
 */
export async function getUrlFirmadaDocumentoViajero(
  db: SupabaseClient<any, any, any>,
  schemaName: string,
  storagePath: string,
  ttlSeconds = 300
): Promise<string> {
  const bucket = bucketNameForSchema('documentos-viajero', schemaName)
  const { data } = await db.storage.from(bucket).createSignedUrl(storagePath, ttlSeconds)
  return data?.signedUrl ?? ''
}

/**
 * Sube el justificante bancario de un pagador (registro público, "Transferencia
 * con justificante") a un bucket privado namespaced por schema. Solo se guarda
 * el path; la visualización se hace con signed URLs de vida corta.
 */
export async function subirJustificantePago(
  db: SupabaseClient<any, any, any>,
  schemaName: string,
  buffer: Buffer,
  contentType: string,
  pagadorExpedienteId: string,
  extension: string
): Promise<{ storage_path: string }> {
  const bucket = bucketNameForSchema('documentos-justificante', schemaName)
  const path = `${pagadorExpedienteId}/justificante-${Date.now()}.${extension}`

  await db.storage.createBucket(bucket, { public: false, fileSizeLimit: 10 * 1024 * 1024 }).catch(() => {})

  const { error } = await db.storage.from(bucket).upload(path, buffer, { contentType, upsert: true })
  if (error) throw new Error(`STORAGE_ERROR: ${error.message}`)

  return { storage_path: path }
}

/**
 * Genera una signed URL de vida corta para el justificante bancario de un pagador.
 */
export async function getUrlFirmadaJustificantePago(
  db: SupabaseClient<any, any, any>,
  schemaName: string,
  storagePath: string,
  ttlSeconds = 300
): Promise<string> {
  const bucket = bucketNameForSchema('documentos-justificante', schemaName)
  const { data } = await db.storage.from(bucket).createSignedUrl(storagePath, ttlSeconds)
  return data?.signedUrl ?? ''
}


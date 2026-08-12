/**
 * Migración: Agregar columna conciliaciones_historico JSONB
 *
 * Almacena el histórico de conciliaciones en contabilidad_movimientos_banco
 * para mantener auditoría de quién vinculó qué cantidad en qué fecha.
 *
 * Ejecutar en Supabase SQL Editor:
 */

export const migrationSQL = `
ALTER TABLE public.contabilidad_movimientos_banco
ADD COLUMN IF NOT EXISTS conciliaciones_historico jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_contabilidad_movimientos_banco_conciliaciones_historico
ON public.contabilidad_movimientos_banco USING GIN (conciliaciones_historico);
`;

/**
 * Estructura de cada elemento en conciliaciones_historico:
 * {
 *   "id": "uuid único de esta conciliación",
 *   "usuario_id": "id del usuario que hizo la conciliación",
 *   "usuario_nombre": "nombre completo del usuario",
 *   "cantidad": 54.00,
 *   "fecha": "2026-08-05T10:17:00Z",
 *   "vobo_dc": false,
 *   "nota": "opcional - comentario sobre la conciliación"
 * }
 */

export interface ConciliacionRegistro {
  id: string;
  usuario_id: string;
  usuario_nombre: string;
  cantidad: number;
  fecha: string;
  vobo_dc: boolean;
  nota?: string | null;
}

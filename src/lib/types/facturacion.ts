export interface NifValidationResult {
  entidad_id: string;
  nombre: string;
  nif: string;
  valid: boolean;
  type: string;
  reason?: string;
}

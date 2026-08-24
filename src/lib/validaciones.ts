export function validarDNI(dni: string): boolean {
  const LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";
  const cleaned = dni.trim().toUpperCase();
  if (!/^\d{8}[A-Z]$/.test(cleaned)) return false;
  const num = parseInt(cleaned.slice(0, 8), 10);
  return cleaned[8] === LETRAS[num % 23];
}

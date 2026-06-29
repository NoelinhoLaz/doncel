// Elimina acentos, eñes, mayúsculas y caracteres raros
export const norm = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quita acentos
    .replace(/[^a-z0-9\s\-]/g, "");   // Deja solo letras, números, espacios y guiones
};

// Convierte un texto largo en un array de palabras clave útiles (filtrando conectores)
export const tokenizarPool = (texto: string = ""): string[] => {
  const palabrasFiltro = new Set(["de", "del", "la", "el", "en", "y", "a", "para", "con", "por", "su", "concepto", "transferencia", "inmediata", "favor"]);
  return norm(texto)
    .split(/[\s\-]+/) // Separa por espacios y guiones
    .filter(p => p.length > 1 && !palabrasFiltro.has(p));
};

// Compara dos arrays de tokens y devuelve cuántas coincidencias exactas hay
export const tokenMatch = (tokensBase: string[], tokensMovimiento: string[]): number => {
  if (!tokensBase.length || !tokensMovimiento.length) return 0;
  const setMovimiento = new Set(tokensMovimiento);
  return tokensBase.filter(t => setMovimiento.has(t)).length;
};

const GREETINGS: Array<(nombre: string) => [string, string, string]> = [
  (n) => ["Hola ", n, ", ¿cómo estás? Espero que bien. Te he preparado tu mapa de situación de hoy — espero que te ayude."],
  (n) => ["¡Hola, ", n, "! Aquí tienes un resumen de cómo va tu día."],
  (n) => ["Hola ", n, ". Aquí tienes lo más importante de hoy, ya organizado para ti."],
  (n) => ["", n, ", he preparado tu panorama del día. Si necesitas algo más, dímelo."],
  (n) => ["Hola ", n, ", espero que tengas un gran día. Esto es lo que he encontrado para ti hoy."],
];

export interface SaludoPartes {
  before: string;
  nombre: string;
  after: string;
}

export function getSaludoDelDia(nombre: string): SaludoPartes {
  const nombreSeguro = nombre?.trim() || "de nuevo";
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const [before, nombreParte, after] = GREETINGS[dayOfYear % GREETINGS.length](nombreSeguro);
  return { before, nombre: nombreParte, after };
}

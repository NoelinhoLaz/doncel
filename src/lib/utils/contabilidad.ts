export function calculateAsientoTotals(apuntes: any[]): {
  totalDebe: number;
  totalHaber: number;
  isBalanced: boolean;
} {
  let totalDebe = 0;
  let totalHaber = 0;
  (apuntes || []).forEach((ap) => {
    totalDebe += Number(ap.debe || 0);
    totalHaber += Number(ap.haber || 0);
  });
  return { totalDebe, totalHaber, isBalanced: Math.abs(totalDebe - totalHaber) < 0.01 };
}

export function formatEuroContable(val: number | null | undefined): string {
  if (!val || Number(val) === 0) return "";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(val));
}

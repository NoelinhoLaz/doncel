export interface BadgeConfig {
  bg: string;
  color: string;
  border?: string;
  text: string;
}

export function getDocTypeBadge(tipo: string): BadgeConfig {
  switch (tipo) {
    case "FACTURA":    return { bg: "#e0f2fe", color: "#0369a1", text: "Factura" };
    case "PROFORMA":   return { bg: "#fef3c7", color: "#b45309", text: "Proforma" };
    case "BORDERO_SEGUROS": return { bg: "#f3e8ff", color: "#6b21a8", text: "Bordero" };
    default:           return { bg: "#f1f5f9", color: "#475569", text: "Albarán" };
  }
}

export function getPaymentStatusBadge(estado: string): BadgeConfig {
  switch (estado) {
    case "PAGADO":   return { bg: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", text: "Pagado" };
    case "PARCIAL":  return { bg: "#fef3c7", color: "#d97706", border: "1px solid #fde68a", text: "Parcial" };
    default:         return { bg: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5", text: "Pendiente" };
  }
}

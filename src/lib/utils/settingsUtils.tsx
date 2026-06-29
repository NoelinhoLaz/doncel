import * as LucideIcons from "lucide-react";
import { resolveLucideIconComponent } from "@/lib/lucideIconResolver";

export function getInitials(nombre: string, apellidos: string) {
  const n = (nombre || "").trim().charAt(0).toUpperCase();
  const a = (apellidos || "").trim().charAt(0).toUpperCase();
  return `${n}${a}`;
}

export function slugifyField(value: string) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeSchemaRows(input: any) {
  if (!Array.isArray(input)) return [];
  if (input.length > 0 && input[0]?.columnas) return input;
  return input.map((f: any, i: number) => ({
    fila_id: `row_${i + 1}`,
    columnas: [{
      ancho: 12,
      campo: f.campo || `campo_${i + 1}`,
      label: f.label || `Campo ${i + 1}`,
      tipo: f.tipo || "text",
      origen: f.origen || "jsonb_detalles",
      propiedades: {
        required: Boolean(f.required),
        placeholder: f.placeholder || "",
        opciones: Array.isArray(f.opciones) ? f.opciones : [],
        rows_textarea: f.rows_textarea || 4,
        default: f.default,
      }
    }]
  }));
}

export function createFieldByType(block: any, idx: number) {
  return {
    ancho: 12,
    campo: block.campo || `campo_${Date.now()}_${idx}`,
    label: block.label || `Campo ${idx}`,
    tipo: block.tipo,
    origen: block.origen || "jsonb_detalles",
    propiedades: {
      required: false,
      placeholder: "",
      opciones: block.tipo === "select" ? ["opcion_1"] : [],
      rows_textarea: block.tipo === "textarea" ? 4 : undefined,
    }
  };
}

export function renderLucideIcon(iconName: string, size = 16) {
  const IconComponent = resolveLucideIconComponent(iconName);
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  return <LucideIcons.FolderPlus size={size} />;
}

"use client";

import * as LucideIcons from "lucide-react";
import { Users, Info, FolderPlus } from "lucide-react";
import ProviderSelector from "@/app/expedientes/[id]/components/ProviderSelector";

interface Props {
  editServiceId: string | null;
  serviceTypes: any[];
  tipo: string; setTipo: (v: string) => void;
  proveedor: string; setProveedor: (v: string) => void;
  descripcion: string; setDescripcion: (v: string) => void;
  opcional: boolean;
  minimoPlazas: string; setMinimoPlazas: (v: string) => void;
  plazas: string; setPlazas: (v: string) => void;
  neto: string; setNeto: (v: string) => void;
  pvp: string; setPvp: (v: string) => void;
  total: string;
  setTotal: (v: string) => void;
  setTotalEdited: (v: boolean) => void;
  formLoading: boolean;
  onBack: () => void;
  isLinked?: boolean;
}

export default function ServicioDetalleForm({
  editServiceId,
  serviceTypes,
  tipo, setTipo,
  proveedor, setProveedor,
  descripcion, setDescripcion,
  opcional,
  minimoPlazas, setMinimoPlazas,
  plazas, setPlazas,
  neto, setNeto,
  pvp, setPvp,
  total, setTotal, setTotalEdited,
  formLoading,
  onBack,
  isLinked,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Categoría */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>Categoría del Servicio *</label>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", backgroundColor: "#f8fafc", padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0", justifyContent: "space-around" }}>
          {serviceTypes.map((cat) => {
            const isSelected = tipo === cat.id;
            const IconComponent = (LucideIcons as any)[cat.icono] || FolderPlus;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setTipo(cat.id)}
                title={cat.label}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "38px", height: "38px", borderRadius: "50%",
                  border: isSelected ? `2px solid ${cat.color}` : "1px solid transparent",
                  backgroundColor: isSelected ? cat.bg : "transparent",
                  color: isSelected ? cat.color : "#94a3b8",
                  cursor: "pointer", transition: "all 0.2s",
                  boxShadow: isSelected ? "0 1px 3px 0 rgba(0, 0, 0, 0.05)" : "none",
                }}
              >
                <IconComponent size={18} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Proveedor */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>Proveedor</label>
        <ProviderSelector value={proveedor} onChange={setProveedor} />
      </div>

      {/* Descripción */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>Descripción del Servicio *</label>
        <input
          type="text"
          placeholder="Ej: Autobús de ida y vuelta..."
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.85rem", outline: "none", backgroundColor: "#ffffff", color: "#0f172a" }}
          required
        />
      </div>

      {/* Mínimo Plazas */}
      {opcional && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>Mínimo Plazas Requeridas</label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Users size={16} style={{ position: "absolute", left: "10px", color: "#94a3b8" }} />
            <input
              type="number"
              placeholder="Ej: 15 (opcional)"
              value={minimoPlazas}
              onChange={(e) => setMinimoPlazas(e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.75rem 0.5rem 2.25rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.85rem", outline: "none", backgroundColor: "#ffffff", color: "#0f172a" }}
              min="1"
            />
          </div>
          <span style={{ fontSize: "0.7rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Info size={12} />
            El servicio se activará automáticamente si se alcanza este mínimo de viajeros.
          </span>
        </div>
      )}

      {/* Precios */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>Precio Neto (€) *</label>
            {isLinked && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.2rem",
                fontSize: "0.6rem",
                color: "#2563eb",
                backgroundColor: "#dbeafe",
                padding: "0.08rem 0.35rem",
                borderRadius: "9999px",
                fontWeight: 600
              }} title="Vinculado a la cotización original">
                <LucideIcons.Link size={8} />
                Link
              </span>
            )}
          </div>
          <input type="number" step="0.01" placeholder="0.00" value={neto} onChange={(e) => setNeto(e.target.value)}
            style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.85rem", outline: "none", backgroundColor: "#ffffff", color: "#0f172a" }}
            required min="0" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>Precio PVP (€) *</label>
            {isLinked && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.2rem",
                fontSize: "0.6rem",
                color: "#2563eb",
                backgroundColor: "#dbeafe",
                padding: "0.08rem 0.35rem",
                borderRadius: "9999px",
                fontWeight: 600
              }} title="Vinculado a la cotización original">
                <LucideIcons.Link size={8} />
                Link
              </span>
            )}
          </div>
          <input type="number" step="0.01" placeholder="0.00" value={pvp} onChange={(e) => setPvp(e.target.value)}
            style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.85rem", outline: "none", backgroundColor: "#ffffff", color: "#0f172a" }}
            required min="0" />
        </div>
      </div>

      {/* Plazas y Total */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>Plazas</label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Users size={16} style={{ position: "absolute", left: "10px", color: "#94a3b8" }} />
            <input type="number" placeholder="1" value={plazas} onChange={(e) => setPlazas(e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.75rem 0.5rem 2.25rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.85rem", outline: "none", backgroundColor: "#ffffff", color: "#0f172a" }}
              min="1" />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>Total Servicio (€)</label>
          <input type="number" step="0.01" placeholder="0.00" value={total}
            onChange={(e) => { setTotal(e.target.value); setTotalEdited(true); }}
            style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.85rem", outline: "none", backgroundColor: "#ffffff", color: "#0f172a" }}
            min="0" />
          <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
            Se calcula automáticamente por defecto, pero puedes editar el total manualmente.
          </span>
        </div>
      </div>

      {/* Acciones */}
      <footer style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem", borderTop: "1px solid #f1f5f9", paddingTop: "1rem" }}>
        {!editServiceId && (
          <button
            type="button"
            onClick={onBack}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer", backgroundColor: "#ffffff", color: "#334155" }}
          >
            Volver
          </button>
        )}
        <button
          type="submit"
          style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer", backgroundColor: "var(--primary-color, #475569)", color: "#ffffff" }}
          disabled={formLoading}
        >
          {formLoading ? "Guardando..." : editServiceId ? "Guardar Cambios" : "Añadir Servicio"}
        </button>
      </footer>
    </div>
  );
}

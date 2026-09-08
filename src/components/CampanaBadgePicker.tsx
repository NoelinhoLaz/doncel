"use client";

import React, { useState, useEffect, useRef } from "react";
import { Target, ChevronDown, Check, X, Search, Loader2 } from "lucide-react";

export interface CampanaOption {
  id: string;
  nombre: string;
  estado?: string;
  color?: string;
}

interface CampanaBadgePickerProps {
  campanaId?: string | null;
  campanaNombre?: string | null;
  campanas?: CampanaOption[];
  onSelect: (campanaId: string | null) => Promise<void> | void;
  disabled?: boolean;
}

export function CampanaBadgePicker({
  campanaId,
  campanaNombre,
  campanas: passedCampanas,
  onSelect,
  disabled = false,
}: CampanaBadgePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadedCampanas, setLoadedCampanas] = useState<CampanaOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const campanasList = passedCampanas ?? loadedCampanas;

  useEffect(() => {
    if (isOpen && !passedCampanas && loadedCampanas.length === 0) {
      setLoadingList(true);
      fetch("/api/crm/campanas")
        .then((r) => r.json())
        .then((res) => {
          if (res?.data && Array.isArray(res.data)) {
            setLoadedCampanas(res.data);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingList(false));
    }
  }, [isOpen, passedCampanas, loadedCampanas.length]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const displayName = campanaNombre || campanasList.find((c) => c.id === campanaId)?.nombre || null;

  const filteredCampanas = campanasList.filter((c) =>
    (c.nombre ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handlePick = async (id: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || saving) return;
    setSaving(true);
    try {
      await onSelect(id);
      setIsOpen(false);
      setSearch("");
    } catch (err) {
      console.error("Error al asignar campaña:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-block" }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled || saving}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title={displayName ? `Campaña: ${displayName}` : "Asignar a una campaña"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: displayName ? "2px 8px" : "2px 6px",
          borderRadius: "9999px",
          fontSize: "0.72rem",
          fontWeight: displayName ? 600 : 500,
          border: displayName ? "1px solid #cbd5e1" : "1px dashed #cbd5e1",
          background: displayName ? "#f8fafc" : "transparent",
          color: displayName ? "#334155" : "#94a3b8",
          cursor: disabled ? "default" : "pointer",
          maxWidth: "160px",
          transition: "all 0.15s ease",
          lineHeight: "1.3",
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.borderColor = "#94a3b8";
            e.currentTarget.style.background = "#f1f5f9";
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.borderColor = displayName ? "#cbd5e1" : "#cbd5e1";
            e.currentTarget.style.background = displayName ? "#f8fafc" : "transparent";
          }
        }}
      >
        <Target size={12} style={{ color: displayName ? "var(--primary-color, #475569)" : "#94a3b8", flexShrink: 0 }} />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {saving ? "Guardando..." : displayName || "Sin campaña"}
        </span>
        {!disabled && (
          saving ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <ChevronDown size={10} style={{ color: "#94a3b8", flexShrink: 0 }} />
          )
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 9999,
            minWidth: "210px",
            background: "#ffffff",
            borderRadius: "8px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            border: "1px solid #e2e8f0",
            padding: "6px",
            animation: "fadeIn 0.1s ease-out",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header & Search */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px 6px",
              borderBottom: "1px solid #f1f5f9",
              marginBottom: "4px",
            }}
          >
            <Search size={12} style={{ color: "#94a3b8", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Buscar campaña..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              style={{
                border: "none",
                outline: "none",
                fontSize: "0.74rem",
                width: "100%",
                background: "transparent",
                color: "#1e293b",
              }}
            />
          </div>

          <div style={{ maxHeight: "180px", overflowY: "auto" }}>
            {/* Opción Desasignar / Sin campaña */}
            <button
              type="button"
              onClick={(e) => handlePick(null, e)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "6px 8px",
                borderRadius: "5px",
                fontSize: "0.74rem",
                color: !campanaId ? "#0f172a" : "#64748b",
                background: !campanaId ? "#f1f5f9" : "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: !campanaId ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (campanaId) e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                if (campanaId) e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <X size={12} style={{ color: "#94a3b8" }} />
                <span>Ninguna (Sin campaña)</span>
              </span>
              {!campanaId && <Check size={13} style={{ color: "var(--primary-color, #475569)" }} />}
            </button>

            {loadingList ? (
              <div style={{ padding: "8px", textAlign: "center", fontSize: "0.72rem", color: "#94a3b8" }}>
                Cargando campañas...
              </div>
            ) : filteredCampanas.length === 0 ? (
              <div style={{ padding: "8px", textAlign: "center", fontSize: "0.72rem", color: "#94a3b8" }}>
                No se encontraron campañas
              </div>
            ) : (
              filteredCampanas.map((c) => {
                const isSelected = c.id === campanaId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={(e) => handlePick(c.id, e)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: "5px",
                      fontSize: "0.74rem",
                      color: isSelected ? "#0f172a" : "#334155",
                      background: isSelected ? "#f1f5f9" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      fontWeight: isSelected ? 600 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Target size={12} style={{ color: "var(--primary-color, #475569)", flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.nombre}</span>
                    </span>
                    {isSelected && <Check size={13} style={{ color: "var(--primary-color, #475569)", flexShrink: 0 }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

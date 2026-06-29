"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";

export default function Localify({ onSelect }: { onSelect: (place: any) => void }) {
  const [query, setQuery] = useState("");

  const handleAdd = () => {
    if (!query.trim()) return;
    
    // Simulamos la estructura que devolvería una API como Google Places
    onSelect({
      id: crypto.randomUUID(),
      nombre: query.trim()
    });
    setQuery("");
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem", width: "100%" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        placeholder="Escribe el nombre del destino..."
        style={{
          flex: 1,
          padding: "0.5rem 0.75rem",
          borderRadius: "0.5rem",
          border: "1px solid #cbd5e1",
          outline: "none",
          fontSize: "0.85rem",
        }}
      />
      <button
        onClick={handleAdd}
        style={{
          padding: "0.5rem 1rem",
          backgroundColor: "#475569",
          color: "white",
          borderRadius: "0.5rem",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "0.85rem",
          fontWeight: 500,
        }}
      >
        <Plus size={16} />
        Añadir
      </button>
    </div>
  );
}
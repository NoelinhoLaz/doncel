"use client";

import { useState } from "react";

export default function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          style={{ background: "none", border: "none", padding: 2, cursor: onChange ? "pointer" : "default", fontSize: "1.6rem", color: n <= (hover || value) ? "#f59e0b" : "#e2e8f0", transition: "color 0.1s", lineHeight: 1 }}
          aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

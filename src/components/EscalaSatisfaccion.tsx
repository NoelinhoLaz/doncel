"use client";

import { useRef } from "react";
import { Frown, Smile } from "lucide-react";

export const NIVELES_SATISFACCION = [
  "Nada satisfecho",
  "Poco satisfecho",
  "Neutral",
  "Satisfecho",
  "Muy satisfecho",
  "Totalmente satisfecho",
];

const COLORES = ["#ef4444", "#f97316", "#facc15", "#a3e635", "#4ade80", "#22c55e"];

function nivelDesdeX(clientX: number, rect: DOMRect): number {
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return Math.min(6, Math.max(1, Math.ceil(ratio * 6)));
}

export default function EscalaSatisfaccion({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromEvent = (clientX: number) => {
    if (!onChange || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    onChange(nivelDesdeX(clientX, rect));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onChange) return;
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromEvent(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateFromEvent(e.clientX);
  };

  const handlePointerUp = () => {
    dragging.current = false;
  };

  const selectedIndex = value > 0 ? value - 1 : -1;

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: 28,
        borderRadius: 999,
        overflow: "hidden",
        cursor: onChange ? "pointer" : "default",
        boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.06)",
        touchAction: "none",
      }}
    >
      {COLORES.map((color, i) => (
        <button
          key={i}
          type="button"
          title={NIVELES_SATISFACCION[i]}
          aria-label={NIVELES_SATISFACCION[i]}
          disabled={!onChange}
          onClick={(e) => {
            e.stopPropagation();
            onChange?.(i + 1);
          }}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            padding: 0,
            background: color,
            opacity: value === 0 || i === selectedIndex ? 1 : 0.35,
            transition: "opacity 0.15s",
            cursor: onChange ? "pointer" : "default",
          }}
        >
          {i === 0 && <Frown size={16} color="#fff" strokeWidth={2} style={{ pointerEvents: "none" }} />}
          {i === COLORES.length - 1 && <Smile size={16} color="#fff" strokeWidth={2} style={{ pointerEvents: "none" }} />}
        </button>
      ))}

      {value > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.35)",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-raleway), sans-serif",
              fontWeight: 700,
              fontSize: "0.82rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgb(24, 24, 27)",
              opacity: 1,
              WebkitTextFillColor: "rgb(24, 24, 27)",
            }}
          >
            {NIVELES_SATISFACCION[selectedIndex]}
          </span>
        </div>
      )}
    </div>
  );
}

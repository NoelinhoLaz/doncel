"use client";

import { useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

interface MatchTooltipWrapperProps {
  label: string;
  badgeStyles: {
    background: string;
    color: string;
    border: string;
  };
  children: ReactNode;
  onShow?: () => void;
  onClick?: () => void;
  /** Sustituye el badge de texto por defecto por un trigger custom (ej. un icono). */
  trigger?: ReactNode;
}

const TOOLTIP_WIDTH = 420;

export function MatchTooltipWrapper({ label, badgeStyles, children, onShow, onClick, trigger }: MatchTooltipWrapperProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimerRef.current = setTimeout(() => {
      setShow(false);
      hideTimerRef.current = null;
    }, 1000);
  }, [cancelHide]);

  // Renderizado vía portal a document.body: si el trigger está dentro de un
  // contenedor con overflow-x/y (ej. el wrapper con scroll de una tabla), un
  // tooltip position:absolute anidado ahí queda recortado por ese ancestro
  // aunque el z-index sea alto. El portal escapa de cualquier overflow y se
  // posiciona con coordenadas de viewport (position: fixed).
  const handleMouseEnter = () => {
    cancelHide();
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const openUp = window.innerHeight - rect.bottom < 300;
      let left = rect.right - TOOLTIP_WIDTH;
      const margen = 8;
      if (left < margen) left = margen;
      if (left + TOOLTIP_WIDTH > window.innerWidth - margen) left = window.innerWidth - margen - TOOLTIP_WIDTH;
      const top = openUp ? rect.top : rect.bottom;
      setPosition({ top, left, openUp });
    }
    setShow(true);
    onShow?.();
  };
  const handleMouseLeave = () => scheduleHide();

  useEffect(() => {
    if (!show) return;
    const handleScrollOrResize = () => setShow(false);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [show]);

  return (
    <div
      ref={triggerRef}
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {trigger ? (
        <span onClick={onClick} style={{ display: "inline-flex", cursor: onClick ? "pointer" : "default" }}>
          {trigger}
        </span>
      ) : (
        <span
          onClick={onClick}
          style={{
            display: "inline-block",
            padding: "0.1rem 0.4rem",
            borderRadius: "0.25rem",
            fontSize: "0.65rem",
            fontWeight: "700",
            background: badgeStyles.background,
            color: badgeStyles.color,
            border: badgeStyles.border,
            textTransform: "uppercase",
            cursor: "pointer",
            transition: "all 0.15s ease-in-out",
          }}
        >
          {label}
        </span>
      )}

      {show &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: position.openUp ? undefined : position.top + 8,
              bottom: position.openUp ? window.innerHeight - position.top + 8 : undefined,
              left: position.left,
              zIndex: 999,
              width: TOOLTIP_WIDTH,
              maxWidth: "90vw",
              boxSizing: "border-box",
              backgroundColor: "rgba(255, 255, 255, 0.96)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              borderRadius: "1rem",
              padding: "1rem",
              boxShadow: "0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04)",
              textAlign: "left",
              overflowWrap: "break-word",
              wordBreak: "break-word",
              fontSize: "0.75rem",
            }}
            onMouseEnter={() => {
              cancelHide();
              setShow(true);
            }}
            onMouseLeave={() => scheduleHide()}
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
}

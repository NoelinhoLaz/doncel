"use client";

import { useState, useRef, useCallback, ReactNode } from "react";

interface MatchTooltipWrapperProps {
  label: string;
  badgeStyles: {
    background: string;
    color: string;
    border: string;
  };
  children: ReactNode;
}

export function MatchTooltipWrapper({ label, badgeStyles, children }: MatchTooltipWrapperProps) {
  const [show, setShow] = useState(false);
  const [openUp, setOpenUp] = useState(false);
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

  const handleMouseEnter = () => {
    cancelHide();
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setOpenUp(window.innerHeight - rect.bottom < 300);
    }
    setShow(true);
  };
  const handleMouseLeave = () => scheduleHide();

  return (
    <div
      ref={triggerRef}
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span style={{
        display: "inline-block",
        padding: "0.2rem 0.5rem",
        borderRadius: "0.25rem",
        fontSize: "0.75rem",
        fontWeight: "700",
        background: badgeStyles.background,
        color: badgeStyles.color,
        border: badgeStyles.border,
        textTransform: "uppercase",
        cursor: "pointer",
        transition: "all 0.15s ease-in-out",
      }}>
        {label}
      </span>

      {show && (
        <div
          style={{
            position: "absolute",
            right: "0px",
            zIndex: 999,
            width: "420px",
            backgroundColor: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(226, 232, 240, 0.9)",
            borderRadius: "1rem",
            padding: "1rem",
            boxShadow: "0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04)",
            textAlign: "left",
            ...(openUp
              ? { bottom: "100%", marginBottom: "0.5rem" }
              : { top: "100%", marginTop: "0.5rem" }
            ),
          }}
          onMouseEnter={() => { cancelHide(); setShow(true); }}
          onMouseLeave={() => scheduleHide()}
        >
          <div style={{ position: "relative" }}>
            <div style={{
              position: "absolute",
              right: "24px",
              borderWidth: "8px",
              borderStyle: "solid",
              pointerEvents: "none",
              ...(openUp
                ? {
                    top: "100%",
                    borderColor: "rgba(255, 255, 255, 0.96) transparent transparent transparent",
                  }
                : {
                    bottom: "100%",
                    borderColor: "transparent transparent rgba(255, 255, 255, 0.96) transparent",
                  }
              ),
            }} />
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

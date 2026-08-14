"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";

interface CopilotoContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const CopilotoContext = createContext<CopilotoContextValue | null>(null);

export function CopilotoProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [isOpen]
  );

  return <CopilotoContext.Provider value={value}>{children}</CopilotoContext.Provider>;
}

export function useCopiloto() {
  const ctx = useContext(CopilotoContext);
  if (!ctx) throw new Error("useCopiloto must be used within a CopilotoProvider");
  return ctx;
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NextUIProvider } from "@nextui-org/react";
import AgentBar from "@/app/components/Header";
import MenuPrincipal from "@/app/components/Sidebar";
import GlobalCopilotoDrawer from "@/components/modals/GlobalCopilotoDrawer";

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [copilotoOpen, setCopilotoOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const savedColor = localStorage.getItem("momo_primary_color");
      if (savedColor) {
        document.documentElement.style.setProperty("--header-bg", savedColor);
        document.documentElement.style.setProperty("--primary-color", savedColor);
      }
    }
  }, []);

  const isLoginPage = pathname === "/login";
  const isAdministracionPage = pathname === "/administracion";
  const isPortal = pathname.startsWith("/portal");
  const isRegistro = pathname.startsWith("/registro");
  const isPreview = pathname.endsWith("/preview");

  // Portal, auth, registro and preview pages don't use the main layout
  if (isLoginPage || isAdministracionPage || isPortal || isRegistro || isPreview) {
    return <>{children}</>;
  }

  if (!mounted) return null;

  return (
    <NextUIProvider>
      <AgentBar />
      <MenuPrincipal onOpenCopiloto={() => setCopilotoOpen(true)} />
      <main style={{
        marginLeft: "40px",
        paddingTop: "60px",
        minHeight: "100vh",
        backgroundColor: "var(--background)"
      }}>
        {children}
      </main>
      <GlobalCopilotoDrawer isOpen={copilotoOpen} onClose={() => setCopilotoOpen(false)} />
    </NextUIProvider>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NextUIProvider } from "@nextui-org/react";
import AgentBar from "@/app/components/Header";
import MenuPrincipal from "@/app/components/Sidebar";
import GlobalCopilotoDrawer from "@/components/modals/GlobalCopilotoDrawer";
import { CopilotoProvider, useCopiloto } from "@/contexts/CopilotoContext";

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <CopilotoProvider>
      <LayoutContentInner>{children}</LayoutContentInner>
    </CopilotoProvider>
  );
}

function LayoutContentInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { isOpen: copilotoOpen, open: openCopiloto, close: closeCopiloto } = useCopiloto();

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const savedColor = localStorage.getItem("momo_primary_color");
      if (savedColor) {
        document.documentElement.style.setProperty("--header-bg", savedColor);
        document.documentElement.style.setProperty("--primary-color", savedColor);
      }
      const savedSecondaryColor = localStorage.getItem("momo_secondary_color");
      if (savedSecondaryColor) {
        document.documentElement.style.setProperty("--secondary-color", savedSecondaryColor);
      }
    }
  }, []);

  const isLoginPage = pathname === "/login" || pathname === "/concilia_login";
  const isAdministracionPage = pathname === "/administracion";
  const isPortal = pathname.startsWith("/portal") || pathname.startsWith("/proveedor");
  const isRegistro = pathname.startsWith("/registro");
  const isPreview = pathname.endsWith("/preview");
  const isPaginaWebPublica = pathname.startsWith("/web/o/") || pathname.startsWith("/web/nego/") || pathname === "/public";
  const isMovimientosApp = pathname.startsWith("/movimientos-app");

  // Portal, auth, registro, preview, published web pages and movimientos-app don't use the main layout
  if (isLoginPage || isAdministracionPage || isPortal || isRegistro || isPreview || isPaginaWebPublica || isMovimientosApp) {
    return <>{children}</>;
  }

  if (!mounted) return null;

  return (
    <NextUIProvider>
      <AgentBar />
      <MenuPrincipal onOpenCopiloto={openCopiloto} />
      <main className="appMain" style={{
        marginLeft: "40px",
        paddingTop: "60px",
        minHeight: "100vh",
        backgroundColor: "var(--background)"
      }}>
        {children}
      </main>
      <GlobalCopilotoDrawer isOpen={copilotoOpen} onClose={closeCopiloto} />
    </NextUIProvider>
  );
}

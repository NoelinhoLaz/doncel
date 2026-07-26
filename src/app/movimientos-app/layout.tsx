import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  manifest: "/concilia-manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1D2441",
  viewportFit: "cover",
};

export default function MovimientosAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Fondo del <body> a #1D2441 solo en esta ruta: cubre el área segura
          (notch/isla dinámica en iOS) detrás de cualquier overlay/modal,
          sin afectar el fondo blanco global del resto de la app. */}
      <style>{`body { background: #1D2441 !important; }`}</style>
      {children}
    </>
  );
}

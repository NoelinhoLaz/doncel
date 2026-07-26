import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  manifest: "/concilia-manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1D2441",
};

export default function MovimientosAppLayout({ children }: { children: React.ReactNode }) {
  return children;
}

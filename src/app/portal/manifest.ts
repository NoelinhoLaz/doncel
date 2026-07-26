import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portal Cliente - Groomy.travel",
    short_name: "Groomy Portal",
    description: "Portal de clientes para gestionar tus viajes y contratos",
    start_url: "/portal/dashboard",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#2563eb",
    icons: [
      { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
  };
}

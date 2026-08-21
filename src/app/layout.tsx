import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat, Roboto, Raleway, Playfair_Display, Special_Elite, Pacifico } from "next/font/google";
import LayoutContent from "@/app/components/LayoutContent";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  weight: ["100", "400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const specialElite = Special_Elite({
  variable: "--font-special-elite",
  subsets: ["latin"],
  weight: ["400"],
});

const pacifico = Pacifico({
  variable: "--font-pacifico",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Alivia",
  description: "Solución integral de agencias de viaje",
  manifest: "/manifest.json",
  openGraph: {
    title: "Alivia",
    description: "Solución integral de agencias de viaje",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Alivia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alivia",
    description: "Solución integral de agencias de viaje",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${roboto.variable} ${raleway.variable} ${playfair.variable} ${specialElite.variable} ${pacifico.variable}`} style={{ colorScheme: 'light' }}>
      <body style={{ background: '#ffffff', color: '#0f172a' }}>
        <LayoutContent>{children}</LayoutContent>
      </body>
    </html>
  );
}




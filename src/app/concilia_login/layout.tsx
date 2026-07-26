import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/concilia-manifest.json",
};

export default function ConciliaLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

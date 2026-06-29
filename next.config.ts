import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.242"],
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  serverExternalPackages: [
    "nodemailer",
    "imapflow",
    "mailparser",
    "node-tnef",
    "tesseract.js",
    "twilio",
    "googleapis",
    "google-auth-library",
    "pg",
    "@supabase/ssr",
    "@supabase/supabase-js",
    "ua-parser-js",
    "react-pdf",
    "pdfjs-dist",
    "@anthropic-ai/sdk",
    "google-auth-library-nodejs",
    "dompurify",
  ],
};

export default nextConfig;

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
  ],
};

export default nextConfig;

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const { email_address, email_password, smtp_host, smtp_port, use_ssl } = await req.json();

    if (!email_address || !email_password || !smtp_host || !smtp_port) {
      return NextResponse.json({ success: false, error: "Faltan parámetros de conexión SMTP." }, { status: 400 });
    }

    const port = Number(smtp_port);
    const secure = use_ssl !== false ? port === 465 : false;

    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port,
      secure,
      auth: { type: "LOGIN", user: email_address, pass: email_password },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });

    await transporter.verify();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const msg: string = err.message ?? "";
    let error = msg;
    if (msg.includes("535") || msg.toLowerCase().includes("authentication failed")) {
      error = "Credenciales incorrectas. Comprueba el correo y la contraseña.";
    } else if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || msg.includes("ENOTFOUND")) {
      error = "No se pudo conectar al servidor SMTP. Comprueba el host y el puerto.";
    } else if (msg.includes("certificate") || msg.includes("SSL")) {
      error = "Error de certificado SSL. Prueba a desactivar SSL/TLS.";
    }
    return NextResponse.json({ success: false, error }, { status: 200 });
  }
}

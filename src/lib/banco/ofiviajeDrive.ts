import { google } from "googleapis";
import { getAnyDriveConfigForCurrentAgency } from "@/actions/usuarios";

export interface DriveTokens {
  drive_access_token?: string | null;
  drive_refresh_token?: string | null;
  drive_token_expiry?: string | null;
  drive_folder?: { id: string; name: string } | null;
}

export interface DriveXmlFile {
  id: string;
  nombre: string;
  modifiedTime: string;
}

function createOAuthClient(tokens: DriveTokens) {
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${process.env.NODE_ENV === "production" ? "https://" : "http://"}${process.env.VERCEL_URL || "localhost:3000"}/api/auth/google-drive-callback`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  oauth2Client.setCredentials({
    access_token: tokens.drive_access_token,
    refresh_token: tokens.drive_refresh_token,
    expiry_date: tokens.drive_token_expiry ? new Date(tokens.drive_token_expiry).getTime() : undefined,
  });

  return oauth2Client;
}

/**
 * Lista (metadatos únicamente, sin descargar) los ficheros .xml en una carpeta
 * de Drive dada, usando las credenciales pasadas explícitamente.
 */
export async function listarXmlEnCarpeta(tokens: DriveTokens): Promise<DriveXmlFile[]> {
  const folder = tokens.drive_folder;
  if (!folder?.id) throw new Error("No hay ninguna carpeta de Drive seleccionada.");

  const oauth2Client = createOAuthClient(tokens);
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const list = await drive.files.list({
    q: `'${folder.id}' in parents and (name contains '.xml' or name contains '.XML') and trashed = false`,
    fields: "files(id,name,modifiedTime)",
    pageSize: 100,
    orderBy: "modifiedTime desc",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });

  return (list.data.files || []).map((f) => ({
    id: f.id!,
    nombre: f.name || f.id!,
    modifiedTime: f.modifiedTime!,
  }));
}

export async function descargarContenidoXml(tokens: DriveTokens, fileId: string): Promise<string> {
  const oauth2Client = createOAuthClient(tokens);
  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "text" }
  );
  return res.data as unknown as string;
}

/**
 * Obtiene las credenciales de Drive + carpeta seleccionada para el flujo
 * manual desde la UI: usa las del usuario actual si tiene Drive conectado,
 * o si no las de cualquier otro usuario de la misma agencia que sí lo tenga
 * (misma fuente que usa el cron), para que no haga falta que cada agente
 * conecte su propio Drive solo para ver el informe.
 */
export async function getDriveTokensUsuarioActual(): Promise<DriveTokens> {
  const driveConfigRes = await getAnyDriveConfigForCurrentAgency();
  if (!driveConfigRes.success || !driveConfigRes.data?.drive_access_token) {
    throw new Error(driveConfigRes.error || "Google Drive no está conectado.");
  }
  return driveConfigRes.data;
}

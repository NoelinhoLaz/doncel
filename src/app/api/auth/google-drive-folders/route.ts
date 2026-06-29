import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";

const redirectUri =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ||
  `${process.env.NODE_ENV === "production" ? "https://" : "http://"}${process.env.VERCEL_URL || "localhost:3000"}/api/auth/google-drive-callback`;

function createOAuthClient(tokens: {
  drive_access_token?: string | null;
  drive_refresh_token?: string | null;
  drive_token_expiry?: string | null;
}) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  oauth2Client.setCredentials({
    access_token: tokens.drive_access_token,
    refresh_token: tokens.drive_refresh_token,
    expiry_date: tokens.drive_token_expiry
      ? new Date(tokens.drive_token_expiry).getTime()
      : undefined,
  });

  return oauth2Client;
}

async function getDriveConfig() {
  const adminSupabase = await createAdminServerClient();
  const {
    data: { user },
    error: userError,
  } = await adminSupabase.auth.getUser();

  if (userError || !user) return null;

  const adminServiceSupabase = createAdminServiceClient();

  // Try to read from dedicated columns first
  const { data: usuario, error: usuarioError } = await adminServiceSupabase
    .from("usuarios")
    .select("drive_access_token, drive_refresh_token, drive_token_expiry, metadata")
    .eq("auth_user_id", user.id)
    .single();

  if (usuarioError) {
    if (usuarioError.code === "42703") {
      // Columns don't exist — read from metadata only
      const { data: metaData, error: metaError } = await adminServiceSupabase
        .from("usuarios")
        .select("metadata")
        .eq("auth_user_id", user.id)
        .single();

      if (metaError || !metaData) return null;

      const driveConfig = metaData.metadata?.drive_config;
      if (!driveConfig?.drive_access_token && !driveConfig?.drive_refresh_token) {
        return null;
      }
      return {
        drive_access_token: driveConfig.drive_access_token || null,
        drive_refresh_token: driveConfig.drive_refresh_token || null,
        drive_token_expiry: driveConfig.drive_token_expiry || null,
      };
    }
    return null;
  }

  if (!usuario) return null;

  const meta = usuario.metadata || {};
  const driveConfig = {
    drive_access_token:
      (usuario as any).drive_access_token || meta.drive_config?.drive_access_token || null,
    drive_refresh_token:
      (usuario as any).drive_refresh_token || meta.drive_config?.drive_refresh_token || null,
    drive_token_expiry:
      (usuario as any).drive_token_expiry || meta.drive_config?.drive_token_expiry || null,
  };

  if (!driveConfig.drive_access_token && !driveConfig.drive_refresh_token) {
    return null;
  }

  return driveConfig;
}

export async function GET(req: NextRequest) {
  try {
    const driveConfig = await getDriveConfig();
    if (!driveConfig) {
      return NextResponse.json({ error: "No Drive credentials found" }, { status: 401 });
    }

    const parentId = req.nextUrl.searchParams.get("parentId") || "root";
    const oauth2Client = createOAuthClient(driveConfig);
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const response = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id,name,parents)",
      orderBy: "name",
      pageSize: 100,
    });

    return NextResponse.json({ folders: response.data.files || [] }, { status: 200 });
  } catch (error: any) {
    console.error("[Drive Folders] Error:", error?.message || error);
    return NextResponse.json(
      { error: error.message || "Failed to list folders" },
      { status: 500 }
    );
  }
}

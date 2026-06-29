import { NextResponse } from "next/server";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const adminSupabase = await createAdminServerClient();
    const {
      data: { user },
      error: userError,
    } = await adminSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ connected: false }, { status: 200 });
    }

    const adminServiceSupabase = createAdminServiceClient();

    // Try to read from dedicated columns first
    const { data: userData, error: dataError } = await adminServiceSupabase
      .from("usuarios")
      .select("drive_access_token, drive_refresh_token, metadata")
      .eq("auth_user_id", user.id)
      .single();

    if (dataError || !userData) {
      // If columns don't exist (42703), fall back to metadata-only query
      if (dataError?.code === "42703") {
        const { data: metaData, error: metaError } = await adminServiceSupabase
          .from("usuarios")
          .select("metadata")
          .eq("auth_user_id", user.id)
          .single();

        if (metaError || !metaData) {
          return NextResponse.json({ connected: false }, { status: 200 });
        }

        const driveConfig = metaData.metadata?.drive_config;
        const hasToken =
          driveConfig &&
          (driveConfig.drive_access_token || driveConfig.drive_refresh_token);

        return NextResponse.json(
          {
            connected: !!hasToken,
            drive_folder: driveConfig?.drive_folder || null,
          },
          { status: 200 }
        );
      }

      return NextResponse.json({ connected: false }, { status: 200 });
    }

    // Check dedicated columns first
    const hasTokenInColumns =
      !!userData.drive_access_token || !!userData.drive_refresh_token;

    // Check metadata fallback
    const driveConfig = userData.metadata?.drive_config;
    const hasTokenInMeta =
      driveConfig &&
      (driveConfig.drive_access_token || driveConfig.drive_refresh_token);

    const isConnected = hasTokenInColumns || !!hasTokenInMeta;
    const driveFolder =
      userData.metadata?.drive_config?.drive_folder || null;

    return NextResponse.json(
      { connected: isConnected, drive_folder: driveFolder },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Drive Check] Error:", error);
    return NextResponse.json({ connected: false }, { status: 500 });
  }
}

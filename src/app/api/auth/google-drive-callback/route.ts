import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";

const redirectUri =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ||
  `${process.env.NODE_ENV === "production" ? "https://" : "http://"}${process.env.VERCEL_URL || "localhost:3000"}/api/auth/google-drive-callback`;

const oauth2Client = new google.auth.OAuth2(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  redirectUri
);

const BASE_REDIRECT =
  process.env.GOOGLE_OAUTH_REDIRECT_BASE ||
  `${process.env.NODE_ENV === "production" ? "https://" : "http://"}${process.env.VERCEL_URL || "localhost:3000"}`;

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const error = req.nextUrl.searchParams.get("error");
    const stateParam = req.nextUrl.searchParams.get("state");
    const stateCookie = req.cookies.get("oauth_state")?.value;

    if (error) {
      return NextResponse.redirect(`${BASE_REDIRECT}?drive_error=${error}`);
    }

    if (!stateParam || !stateCookie || stateParam !== stateCookie) {
      return NextResponse.redirect(`${BASE_REDIRECT}?drive_error=invalid_state`);
    }

    if (!code) {
      return NextResponse.redirect(`${BASE_REDIRECT}?drive_error=no_code`);
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("No access token received from Google");
    }

    // Get current authenticated user
    const adminSupabase = await createAdminServerClient();
    const {
      data: { user },
      error: userError,
    } = await adminSupabase.auth.getUser();

    if (userError || !user) {
      console.error("[Drive Callback] Auth error:", userError);
      throw new Error("Not authenticated — session expired");
    }

    const adminServiceSupabase = createAdminServiceClient();

    // Compute expiry timestamp correctly:
    // tokens.expiry_date is already in milliseconds (Unix epoch ms)
    const expiryDate = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    // ─── Step 1: Try dedicated columns (if migration has been run) ────────────
    const { error: columnUpdateError } = await adminServiceSupabase
      .from("usuarios")
      .update({
        drive_access_token: tokens.access_token,
        drive_refresh_token: tokens.refresh_token || null,
        drive_token_expiry: expiryDate,
      })
      .eq("auth_user_id", user.id);

    if (columnUpdateError) {
      // Columns don't exist yet → fall back to storing in metadata JSONB
      console.warn(
        "[Drive Callback] Dedicated columns not found (migration pending). Falling back to metadata JSONB.",
        columnUpdateError.message
      );

      // Fetch current metadata to preserve existing values (e.g. drive_folder)
      const { data: userData, error: fetchError } = await adminServiceSupabase
        .from("usuarios")
        .select("metadata")
        .eq("auth_user_id", user.id)
        .single();

      if (fetchError || !userData) {
        throw new Error(`Could not fetch user metadata: ${fetchError?.message}`);
      }

      const metadata = userData.metadata || {};
      const currentDriveConfig = metadata.drive_config || {};

      const updatedMetadata = {
        ...metadata,
        drive_config: {
          ...currentDriveConfig,
          drive_access_token: tokens.access_token,
          // Only overwrite refresh_token if Google sent a new one; otherwise keep the existing one
          drive_refresh_token:
            tokens.refresh_token || currentDriveConfig.drive_refresh_token || null,
          drive_token_expiry: expiryDate,
        },
      };

      const { error: metaUpdateError } = await adminServiceSupabase
        .from("usuarios")
        .update({ metadata: updatedMetadata })
        .eq("auth_user_id", user.id);

      if (metaUpdateError) {
        throw new Error(`Failed to save tokens to metadata: ${metaUpdateError.message}`);
      }

    }

    const successResponse = NextResponse.redirect(`${BASE_REDIRECT}?drive_connected=true`);
    successResponse.cookies.delete("oauth_state");
    return successResponse;
  } catch (error: any) {
    console.error("[Drive Callback] Fatal error:", error?.message || error);
    const errorResponse = NextResponse.redirect(`${BASE_REDIRECT}?drive_error=callback_failed`);
    errorResponse.cookies.delete("oauth_state");
    return errorResponse;
  }
}

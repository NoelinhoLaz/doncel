import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import crypto from "crypto";

const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${process.env.NODE_ENV === 'production' ? 'https://' : 'http://'}${process.env.VERCEL_URL || 'localhost:3000'}/api/auth/google-drive-callback`;

const oauth2Client = new google.auth.OAuth2(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  redirectUri
);

export async function GET() {
  try {
    const scopes = [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/userinfo.email",
    ];

    const state = crypto.randomBytes(32).toString("hex");

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state,
    });

    const response = NextResponse.json({ authUrl }, { status: 200 });
    response.cookies.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10, // 10 minutos — tiempo suficiente para completar el flujo
    });

    return response;
  } catch (error) {
    console.error("Error generating Google Auth URL:", error);
    return NextResponse.json(
      { error: "Failed to generate auth URL" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Proxy Twilio media content (images) so the browser can display them
 * without exposing Twilio credentials.
 *
 * URL: /api/whatsapp/media/{MessageSid}/{MediaSid}
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ messageSid: string; mediaSid: string }> }
) {
  const { messageSid, mediaSid } = await params;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return new NextResponse("Twilio not configured", { status: 500 });
  }

  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  try {
    // Fetch the media content directly (no .json suffix = binary response)
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}/Media/${mediaSid}`;
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${basicAuth}` },
      redirect: "follow",
    });

    if (!res.ok) {
      // Try with JSON suffix to get metadata (some API versions require this)
      const metaUrl = `${url}.json`;
      const metaRes = await fetch(metaUrl, {
        headers: { Authorization: `Basic ${basicAuth}` },
      });
      if (!metaRes.ok) {
        return new NextResponse("Media not found", { status: 404 });
      }
      const meta = await metaRes.json();
      const mediaUri: string = meta.uri || meta.subresource_uris?.media || "";
      if (!mediaUri) {
        return new NextResponse("No media URI", { status: 404 });
      }
      const contentUrl = mediaUri.startsWith("http")
        ? mediaUri
        : `https://api.twilio.com${mediaUri}`;
      const contentRes = await fetch(contentUrl, {
        headers: { Authorization: `Basic ${basicAuth}` },
        redirect: "follow",
      });
      if (!contentRes.ok) {
        return new NextResponse("Failed to fetch media content", { status: 502 });
      }
      const buffer = await contentRes.arrayBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": meta.content_type || "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e: any) {
    console.error("Media proxy error:", e?.message);
    return new NextResponse("Failed to fetch media", { status: 500 });
  }
}

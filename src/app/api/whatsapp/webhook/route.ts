import { NextRequest, NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";
import twilio from "twilio";

export const dynamic = "force-dynamic";

/**
 * Twilio incoming WhatsApp webhook.
 * Configure in Twilio Console → WhatsApp Sandbox / Sender settings:
 *   "When a message comes in" → https://<your-domain>/api/whatsapp/webhook  (HTTP POST)
 *
 * Twilio POSTs application/x-www-form-urlencoded with fields:
 *   From, To, Body, MessageSid, NumMedia, ProfileName, WaId, ...
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    // Signature validation (skip if no auth token configured — sandbox/dev)
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioSig = request.headers.get("x-twilio-signature");
    if (authToken && twilioSig) {
      const url = request.nextUrl.href;
      const isValid = twilio.validateRequest(authToken, twilioSig, url, params);
      if (!isValid) {
        console.warn("Twilio webhook signature validation failed");
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const from = params.From || ""; // e.g. "whatsapp:+34666111222"
    const body = params.Body || "";
    const sid = params.MessageSid || params.SmsMessageSid || null;
    const profileName = params.ProfileName || null;
    const numMedia = parseInt(params.NumMedia || "0", 10);

    // Extract media URLs sent by Twilio (MediaUrl0, MediaContentType0, etc.)
    const media: Array<{ sid: string; contentType: string }> = [];
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = params[`MediaUrl${i}`];
      const ct = params[`MediaContentType${i}`] || "image/jpeg";
      if (mediaUrl) {
        // MediaUrl looks like: https://api.twilio.com/.../Messages/SMxxx/Media/MExxx
        const parts = mediaUrl.match(/\/Messages\/([^/]+)\/Media\/([^/]+)/);
        if (parts) {
          media.push({ sid: parts[2], contentType: ct });
        }
      }
    }

    const phone = from.replace(/^whatsapp:/, "").trim();
    if (!phone) {
      return new NextResponse("<Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb.from("comunicaciones_whatsapp").insert({
      phone,
      direction: "inbound",
      body,
      twilio_sid: sid,
      status: "received",
      metadatos: {
        profile_name: profileName,
        media: media.length > 0 ? media : undefined,
        raw: params,
      },
    });
    if (error) {
      console.error("Webhook insert error:", error);
    }

    // Empty TwiML response — no auto-reply
    return new NextResponse("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (e: any) {
    console.error("WhatsApp webhook error:", e);
    return new NextResponse("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}

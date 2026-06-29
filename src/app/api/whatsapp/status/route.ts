import { NextRequest, NextResponse } from "next/server";
import { getAgencyDbClient } from "@/lib/agencyDb";
import twilio from "twilio";

export const dynamic = "force-dynamic";

/**
 * Twilio status callback for outbound WhatsApp messages.
 * Configure in Twilio Console under your sender's "Status callback URL":
 *   https://<your-domain>/api/whatsapp/status
 *
 * Fields posted: MessageSid, MessageStatus, ErrorCode, ErrorMessage, ...
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioSig = request.headers.get("x-twilio-signature");
    if (authToken && twilioSig) {
      const url = request.nextUrl.href;
      const isValid = twilio.validateRequest(authToken, twilioSig, url, params);
      if (!isValid) return new NextResponse("Forbidden", { status: 403 });
    }

    const sid = params.MessageSid || params.SmsMessageSid;
    const status = params.MessageStatus || params.SmsStatus;
    const errorCode = params.ErrorCode || null;
    const errorMessage = params.ErrorMessage || null;
    if (!sid) return NextResponse.json({ ok: true });

    const agencyDb = await getAgencyDbClient();
    const { error } = await agencyDb
      .from("comunicaciones_whatsapp")
      .update({
        status,
        error_code: errorCode,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("twilio_sid", sid);
    if (error) console.error("Status callback update error:", error);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("WhatsApp status callback error:", e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

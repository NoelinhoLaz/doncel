"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import twilio from "twilio";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a phone string into E.164 (+digits). Returns null if invalid. */
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+") && cleaned.length >= 8) return cleaned;
  // Assume Spain if no country code (adjust to taste)
  if (/^\d{9}$/.test(cleaned)) return `+34${cleaned}`;
  if (/^\d{10,15}$/.test(cleaned)) return `+${cleaned}`;
  return null;
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("Twilio credentials missing (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).");
  }
  return twilio(sid, token);
}

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

export interface WhatsappMessage {
  id: string;
  phone: string;
  direction: "inbound" | "outbound";
  body: string;
  twilio_sid: string | null;
  status: string | null;
  created_at: string;
  media?: Array<{ sid: string; contentType: string }>;
}

/** Send a freeform WhatsApp message (requires open 24h session window). */
export async function sendWhatsappMessage(toRaw: string, body: string, mediaUrls?: string[]) {
  try {
    const to = normalizePhone(toRaw);
    if (!to) return { success: false, error: "Número de teléfono inválido" };

    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!from) return { success: false, error: "TWILIO_WHATSAPP_FROM no configurado" };

    const client = getTwilioClient();
    const msg = await client.messages.create({
      from,
      to: `whatsapp:${to}`,
      body: body?.trim() || undefined,
      mediaUrl: mediaUrls?.length ? mediaUrls : undefined,
    });

    // If we sent media, wait briefly and fetch the media SIDs from Twilio
    let savedMedia: Array<{ sid: string; contentType: string }> | undefined;
    if (mediaUrls?.length) {
      try {
        // Wait for Twilio to process the media
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const mediaList = await client.messages(msg.sid).media.list({ limit: 10 });
        if (mediaList && mediaList.length > 0) {
          savedMedia = mediaList.map((med: any) => ({
            sid: med.sid,
            contentType: med.contentType || "application/octet-stream",
          }));
        }
      } catch {
        // Media fetch might fail for very recent messages — not critical
      }
    }

    // Persist outbound
    const agencyDb = await getAgencyDbClient();
    const insertPayload: Record<string, any> = {
      phone: to,
      direction: "outbound",
      twilio_sid: msg.sid,
      status: msg.status || "queued",
    };
    if (body?.trim()) {
      insertPayload.body = body.trim();
    }
    if (savedMedia?.length) {
      insertPayload.metadatos = { media: savedMedia };
    }
    const { data, error } = await agencyDb
      .from("comunicaciones_whatsapp")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error("sendWhatsappMessage DB insert error:", error);
      // Twilio already sent it; surface a soft warning instead of full failure
      return {
        success: true,
        warning: "Mensaje enviado pero no se pudo registrar en BD",
        data: null,
        twilioSid: msg.sid,
      };
    }

    return { success: true, data, twilioSid: msg.sid };
  } catch (e: any) {
    console.error("sendWhatsappMessage error:", e);
    return { success: false, error: e?.message || "Error al enviar WhatsApp" };
  }
}

/** Fetch the full message thread for a phone number, merging DB + Twilio API. */
export async function getWhatsappThread(phoneRaw: string): Promise<WhatsappMessage[]> {
  try {
    const phone = normalizePhone(phoneRaw);
    if (!phone) return [];

    // 1) DB rows
    const agencyDb = await getAgencyDbClient();
    const { data: dbRows, error } = await agencyDb
      .from("comunicaciones_whatsapp")
      .select("id, phone, direction, body, twilio_sid, status, created_at, metadatos")
      .eq("phone", phone)
      .order("created_at", { ascending: true });
    if (error) console.error("getWhatsappThread DB error:", error);

    // 2) Twilio API rows (outbound and inbound)
    let twilioRows: WhatsappMessage[] = [];
    try {
      const client = getTwilioClient();
      const waFrom = process.env.TWILIO_WHATSAPP_FROM || "";
      const waPeer = `whatsapp:${phone}`;
      const [outbound, inbound] = await Promise.all([
        client.messages.list({ from: waFrom, to: waPeer, limit: 50 }),
        client.messages.list({ from: waPeer, to: waFrom, limit: 50 }),
      ]);
      const all = [...outbound, ...inbound];

      // Build messages with media — try fetching media for every message
      twilioRows = await Promise.all(
        all.map(async (m: any) => {
          let media: Array<{ sid: string; contentType: string }> = [];
          try {
            const mediaList = await client.messages(m.sid).media.list({ limit: 10 });
            if (mediaList && mediaList.length > 0) {
              media = mediaList.map((med: any) => ({
                sid: med.sid,
                contentType: med.contentType || "image/jpeg",
              }));
            }
          } catch {
            // No media for this message
          }
          return {
            id: m.sid,
            phone,
            direction: (m.direction || "").includes("inbound") ? "inbound" : "outbound",
            body: m.body || "",
            twilio_sid: m.sid,
            status: m.status || null,
            created_at: new Date(m.dateCreated || m.dateSent || Date.now()).toISOString(),
            media: media.length > 0 ? media : undefined,
          };
        })
      );
    } catch (twErr: any) {
      console.warn("getWhatsappThread Twilio fetch skipped:", twErr?.message);
    }

    // 3) Merge: DB rows by id, Twilio rows by sid; dedupe (Twilio takes precedence when it has media info)
    const map = new Map<string, WhatsappMessage>();
    // DB first
    for (const m of (dbRows || []) as any[]) {
      const meta = m.metadatos || {};
      const media = Array.isArray(meta.media) ? meta.media : undefined;
      map.set(m.twilio_sid || m.id, {
        id: m.id,
        phone,
        direction: m.direction,
        body: m.body || "",
        twilio_sid: m.twilio_sid,
        status: m.status,
        created_at: m.created_at,
        media,
      });
    }
    // Twilio rows — only set if not already in map (DB wins for body/status, but we merge media)
    for (const m of twilioRows) {
      const key = m.twilio_sid || m.id;
      if (map.has(key)) {
        const existing = map.get(key)!;
        // If DB has no media but Twilio does, merge it
        if (!existing.media && m.media) {
          existing.media = m.media;
        }
      } else {
        map.set(key, m);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  } catch (e: any) {
    console.error("getWhatsappThread failed:", e?.message);
    return [];
  }
}

/** List distinct phone numbers with the latest message snippet — for an inbox view. */
export async function getWhatsappConversations() {
  type Conv = { phone: string; lastBody: string; lastAt: string; lastDirection: string; lastMediaType?: "image" | "document" };
  try {
    // 1) DB rows
    const agencyDb = await getAgencyDbClient();
    const { data: dbRows, error } = await agencyDb
      .from("comunicaciones_whatsapp")
      .select("phone, direction, body, created_at, metadatos")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) console.error("getWhatsappConversations DB error:", error);

    // 2) Twilio API — pull all recent messages for the account
    let twilioPeers = new Map<string, Conv>();
    try {
      const client = getTwilioClient();
      const waFrom = process.env.TWILIO_WHATSAPP_FROM || "";
      const msgs = await client.messages.list({ limit: 100 });
      for (const m of msgs) {
        const rawFrom = m.from || "";
        const rawTo = m.to || "";
        const peerRaw = rawFrom === waFrom ? rawTo : rawFrom;
        let peer = peerRaw.replace(/^whatsapp:/, "").trim();
        if (!peer) continue;
        // Normalize: strip any wa- prefix and normalize phone
        peer = normalizePhone(peer.replace(/^wa-/i, "")) || peer;
        const createdAt = new Date(m.dateCreated || m.dateSent || Date.now()).toISOString();
        const existing = twilioPeers.get(peer);
        const numMedia = Number(m.numMedia) || 0;
        let lastMediaType: "image" | "document" | undefined;
        if (numMedia > 0) {
          // Try to fetch the first media to determine type
          try {
            const mediaList = await client.messages(m.sid).media.list({ limit: 1 });
            if (mediaList && mediaList.length > 0) {
              const ct = (mediaList[0] as any).contentType || "";
              lastMediaType = ct.startsWith("image/") ? "image" : "document";
            }
          } catch {
            lastMediaType = "document";
          }
        }
        if (!existing || createdAt > existing.lastAt) {
          twilioPeers.set(peer, {
            phone: peer,
            lastBody: m.body || "",
            lastAt: createdAt,
            lastDirection: (m.direction || "").includes("inbound") ? "inbound" : "outbound",
            lastMediaType,
          });
        }
      }
    } catch (twErr: any) {
      console.warn("getWhatsappConversations Twilio fetch skipped:", twErr?.message);
    }

    // 3) Merge: DB rows into the map, keep the latest per phone
    const seen = twilioPeers;
    for (const row of (dbRows || []) as Array<{ phone: string; direction: string; body: string; created_at: string; metadatos?: any }>) {
      const rowPhone = normalizePhone(row.phone.replace(/^wa-/i, "")) || row.phone;
      const existing = seen.get(rowPhone);
      const mediaArr = (row.metadatos && Array.isArray(row.metadatos.media)) ? row.metadatos.media : [];
      const hasMedia = mediaArr.length > 0;
      let lastMediaType: "image" | "document" | undefined;
      if (hasMedia && mediaArr[0]?.contentType) {
        lastMediaType = mediaArr[0].contentType.startsWith("image/") ? "image" : "document";
      } else if (hasMedia) {
        lastMediaType = "document";
      }
      if (!existing || row.created_at > existing.lastAt) {
        seen.set(rowPhone, {
          phone: rowPhone,
          lastBody: row.body,
          lastAt: row.created_at,
          lastDirection: row.direction,
          lastMediaType,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  } catch (e: any) {
    console.error("getWhatsappConversations failed:", e?.message);
    return [];
  }
}

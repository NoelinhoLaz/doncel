"use server";

import { getCurrentUserEmailConfig } from "./usuarios";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { verifyToken } from "@/lib/encryption";

const PAGE_SIZE = 10;

interface SimpleEmail {
  id: string;
  senderName: string;
  subject: string;
  threadKey: string; // normalized subject for grouping
  time: string;
  body: string;
  bodyHtml?: string;
  color: string;
  avatarText: string;
  starred: boolean;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string;
  companyLocation: string;
  companyIndustry: string;
  companyFounded: string;
  companyEmployees: string;
  companyRevenue: string;
  companyLogoText: string;
  companyLogoColor: string;
  attachments: string[];
  thread: Array<{
    id: string;
    senderName: string;
    senderEmail: string;
    avatarColor: string;
    date: string;
    dateMs: number;
    body: string;
    bodyHtml?: string;
    direction: "inbound" | "outbound";
    subject: string;
  }>;
  whatsappThread: any[];
}

// Clean email body preview text
function cleanText(text: string | undefined): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().substring(0, 800);
}

// Generate a tone of the primary color based on sender name
// Uses color-mix so it adapts automatically to the agency brand color
function getPremiumColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Pick a mix percentage (30%–90%) and blend direction (lighter or darker)
  const idx = Math.abs(hash) % 10;
  const mixes = [
    "color-mix(in srgb, var(--primary-color, #475569) 90%, black)",
    "color-mix(in srgb, var(--primary-color, #475569) 75%, black)",
    "color-mix(in srgb, var(--primary-color, #475569) 60%, black)",
    "color-mix(in srgb, var(--primary-color, #475569) 45%, black)",
    "color-mix(in srgb, var(--primary-color, #475569) 30%, black)",
    "color-mix(in srgb, var(--primary-color, #475569) 55%, white)",
    "color-mix(in srgb, var(--primary-color, #475569) 65%, white)",
    "color-mix(in srgb, var(--primary-color, #475569) 75%, white)",
    "color-mix(in srgb, var(--primary-color, #475569) 85%, white)",
    "color-mix(in srgb, var(--primary-color, #475569) 70%, black)",
  ];
  return mixes[idx];
}

// Promisify the callback-based node-tnef parseBuffer
function decodeTnef(content: Buffer): Promise<string[]> {
  return new Promise((resolve) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const tnef = require("node-tnef");
      tnef.parseBuffer(content, (err: any, result: any) => {
        if (err || !result) {
          resolve([]);
          return;
        }
        const names: string[] = (result.Attachments || [])
          .map((a: any, i: number) => {
            // node-tnef stores filename in .Title
            const title = a.Title || "";
            return title.trim() ? title.trim() : `adjunto_${i + 1}`;
          })
          .filter(Boolean);
        resolve(names);
      });
    } catch (e) {
      console.warn("[TNEF] Failed to require node-tnef:", e);
      resolve([]);
    }
  });
}

// Extract real attachment names, decoding winmail.dat (TNEF) if needed
async function extractAttachments(parsedAttachments: any[]): Promise<string[]> {
  const result: string[] = [];

  for (const a of parsedAttachments || []) {
    const filename = (a.filename || "").trim();
    const ctype = (a.contentType || "").toLowerCase();

    const isTnef =
      filename.toLowerCase() === "winmail.dat" ||
      ctype === "application/ms-tnef" ||
      ctype === "application/vnd.ms-tnef";

    if (isTnef) {
      if (a.content) {
        const realNames = await decodeTnef(a.content);
        if (realNames.length > 0) {
          result.push(...realNames);
        }
        // Either way, don't push winmail.dat itself
      }
      continue;
    }

    if (filename) {
      result.push(filename);
    }
    // Skip attachments with no name (inline images, etc.)
  }

  return result;
}

// Build and connect IMAP client
async function buildImapClient(config: any): Promise<ImapFlow> {
  const host =
    config.email_imap_host ||
    (config.email_provider === "gmail"
      ? "imap.gmail.com"
      : "outlook.office365.com");
  const port = config.email_imap_port ? Number(config.email_imap_port) : 993;
  const secure = config.email_use_ssl !== false;

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: {
      user: config.email_address,
      pass: config.email_password_enc ? (verifyToken(config.email_password_enc) ?? config.email_password_enc) : "",
    },
    logger: false,
    connectionTimeout: 15000,
  });

  await client.connect();
  return client;
}

// Build HTML body with inline images resolved from attachments
function buildEmailHtml(html: string | undefined, attachments: any[]): string | undefined {
  if (!html) return undefined;
  // Build cid → base64 data URL map
  const cidMap = new Map<string, string>();
  for (const a of attachments || []) {
    const cid = a.cid || a.contentId;
    if (cid && a.content) {
      const base64 = Buffer.isBuffer(a.content)
        ? a.content.toString("base64")
        : Buffer.from(a.content).toString("base64");
      const mime = a.contentType || "application/octet-stream";
      cidMap.set(cid, `data:${mime};base64,${base64}`);
    }
  }
  if (cidMap.size === 0) return html;
  // Replace cid: references
  let result = html;
  for (const [cid, dataUrl] of cidMap) {
    result = result.replace(new RegExp(`cid:${escapeRegex(cid)}`, "gi"), dataUrl);
  }
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Normalize subject for thread grouping (strip Re:, Fwd:, etc.)
function normalizeSubject(subject: string): string {
  return subject
    .replace(/^((Re|RE|Fwd|FWD|Fw|FW|RV|AW|SV|TR)\s*:\s*)+/gi, "")
    .trim()
    .toLowerCase();
}

// Find the Sent folder in the IMAP account
async function findSentFolder(client: ImapFlow): Promise<string | null> {
  try {
    const list = await client.list();
    // Prefer special-use \Sent attribute
    const bySpecial = (list as any[]).find(
      (f) => f.specialUse === "\\Sent" || (f.flags instanceof Set && f.flags.has("\\Sent"))
    );
    if (bySpecial) return bySpecial.path;
    // Fallback: name contains "sent"
    const byName = (list as any[]).find((f) => /sent/i.test(f.name || f.path || ""));
    return byName?.path || null;
  } catch {
    return null;
  }
}

// Parse a single IMAP message into SimpleEmail
async function parseMessage(msg: any, direction: "inbound" | "outbound" = "inbound"): Promise<SimpleEmail | null> {
  try {
    if (!msg.source) return null;
    const parsed = await simpleParser(msg.source);

    const senderName =
      parsed.from?.value?.[0]?.name ||
      parsed.from?.value?.[0]?.address?.split("@")[0] ||
      "Remitente";
    const senderEmailAddress = parsed.from?.value?.[0]?.address || "";
    const subject = parsed.subject || "(Sin asunto)";
    const threadKey = normalizeSubject(subject);
    const cleanBody = cleanText(parsed.text || "");

    const dateObj = parsed.date ? new Date(parsed.date) : new Date();
    const timeStr = dateObj.toLocaleString("es-ES", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const avatarText =
      senderName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase() || "E";

    const attachments = await extractAttachments(parsed.attachments || []);
    const bodyHtml = buildEmailHtml((parsed as any).html, parsed.attachments || []);

    return {
      id: `real-${msg.uid || msg.seq}`,
      senderName: direction === "outbound" ? "Tú" : senderName,
      subject,
      threadKey,
      time: timeStr,
      body: cleanBody,
      bodyHtml,
      color: getPremiumColor(direction === "outbound" ? senderEmailAddress : senderName),
      avatarText: direction === "outbound" ? "TÚ" : avatarText,
      starred: false,
      contactName: senderName,
      contactRole: direction === "outbound" ? "Enviado" : "Contacto Externo",
      contactEmail: senderEmailAddress,
      contactPhone: "No especificado",
      companyName: senderEmailAddress.split("@")[1] || "Externo",
      companyLocation: "Ubicación desconocida",
      companyIndustry: "Hosting / Mail Domain",
      companyFounded: "N/A",
      companyEmployees: "N/A",
      companyRevenue: "N/A",
      companyLogoText: avatarText,
      companyLogoColor: getPremiumColor(senderEmailAddress.split("@")[1] || "Externo"),
      attachments,
      thread: [
        {
          id: `t-${msg.uid || msg.seq}-1`,
          senderName,
          senderEmail: senderEmailAddress,
          avatarColor: getPremiumColor(senderName),
          date: dateObj.toLocaleString("es-ES"),
          dateMs: dateObj.getTime(),
          body: parsed.text || "",
          bodyHtml,
          direction,
          subject,
        },
      ],
      whatsappThread: [],
    };
  } catch (err) {
    console.error("[IMAP] Error parsing message:", err);
    return null;
  }
}

// Main server action: fetch inbox + sent emails, each email enriched with its full thread
// Always fetches the last PAGE_SIZE messages; page>1 goes further back
export async function downloadRealInboxEmails(page: number = 1) {
  try {
    const configRes = await getCurrentUserEmailConfig();
    if (!configRes.success || !configRes.data?.email_address) {
      return { success: false, error: "No se encontró configuración de correo activa para el usuario." };
    }

    const client = await buildImapClient(configRes.data);

    // ── Fetch INBOX ──────────────────────────────────────────────────────────
    const inboxEmails: SimpleEmail[] = [];
    let totalMessages = 0;
    let hasMore = false;

    const inboxLock = await client.getMailboxLock("INBOX");
    try {
      const mailbox = client.mailbox;
      if (!mailbox) throw new Error("No se pudo acceder a la bandeja de entrada.");
      totalMessages = mailbox.exists || 0;

      if (totalMessages > 0) {
        // Always paginate by sequence number from the end — no date filter
        const endSeq = Math.max(1, totalMessages - (page - 1) * PAGE_SIZE);
        const startSeq = Math.max(1, endSeq - PAGE_SIZE + 1);
        const seqNums: number[] = [];
        for (let i = endSeq; i >= startSeq; i--) seqNums.push(i);

        hasMore = startSeq > 1;

        for await (const msg of client.fetch(seqNums.join(","), { envelope: true, source: true })) {
          const email = await parseMessage(msg, "inbound");
          if (email) inboxEmails.push(email);
        }
      }
    } finally {
      inboxLock.release();
    }

    // ── Fetch Sent folder (to enrich threads) ────────────────────────────────
    const sentByThread = new Map<string, SimpleEmail["thread"]>();
    const sentFolder = await findSentFolder(client);
    if (sentFolder) {
      try {
        const sentLock = await client.getMailboxLock(sentFolder);
        try {
          const sentMailbox = client.mailbox;
          const sentTotal = sentMailbox ? (sentMailbox.exists || 0) : 0;
          if (sentTotal > 0) {
            const sEnd = sentTotal;
            const sStart = Math.max(1, sentTotal - PAGE_SIZE * page + 1);
            const sSeqs: number[] = [];
            for (let i = sEnd; i >= sStart; i--) sSeqs.push(i);
            for await (const msg of client.fetch(sSeqs.join(","), { envelope: true, source: true })) {
              const email = await parseMessage(msg, "outbound");
              if (!email) continue;
              const existing = sentByThread.get(email.threadKey) || [];
              existing.push(...email.thread);
              sentByThread.set(email.threadKey, existing);
            }
          }
        } finally {
          sentLock.release();
        }
      } catch (sentErr) {
        console.warn("[IMAP] Could not fetch sent folder:", sentErr);
      }
    }

    await client.logout();

    // ── Build per-thread index from inbox emails too ──────────────────────────
    // So clicking "Re: X" also shows the original "X" from the inbox
    const inboxByThread = new Map<string, SimpleEmail["thread"]>();
    for (const email of inboxEmails) {
      const existing = inboxByThread.get(email.threadKey) || [];
      existing.push(...email.thread);
      inboxByThread.set(email.threadKey, existing);
    }

    // ── Enrich each inbox email with its full thread ──────────────────────────
    for (const email of inboxEmails) {
      const allMsgs = [
        ...(inboxByThread.get(email.threadKey) || []),
        ...(sentByThread.get(email.threadKey) || []),
      ];
      email.thread = allMsgs
        .filter((m, idx, arr) =>
          arr.findIndex((x) => x.dateMs === m.dateMs && x.body === m.body) === idx
        )
        .sort((a, b) => (a.dateMs || 0) - (b.dateMs || 0));
    }

    // Sort newest first
    inboxEmails.sort((a, b) => {
      const aMs = Math.max(...a.thread.map((m) => m.dateMs || 0));
      const bMs = Math.max(...b.thread.map((m) => m.dateMs || 0));
      return bMs - aMs;
    });

    return { success: true, emails: inboxEmails, hasMore, total: totalMessages, page };
  } catch (err: any) {
    console.error("[IMAP] Connection/Fetch failed:", err);
    return { success: false, error: err.message || "Error de conexión con el servidor de correo IMAP." };
  }
}

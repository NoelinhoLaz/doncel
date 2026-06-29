export interface ThreadMessage {
  id: string;
  senderName: string;
  senderEmail?: string;
  avatarColor?: string;
  date?: string;
  body?: string;
  bodyHtml?: string;
  direction?: "inbound" | "outbound";
}

export interface WhatsAppMessage {
  id: string;
  senderName: string;
  senderRole?: "agent" | "client" | string;
  body: string;
  time?: string;
  media?: any[];
  twilioSid?: string;
}

export interface Attachment {
  name: string;
  url?: string;
  contentType?: string;
  sid?: string;
}

export interface Email {
  id: string;
  senderName: string;
  subject: string;
  time: string;
  body: string;
  bodyHtml?: string;
  color: string;
  avatarText: string;
  starred: boolean;
  contactName: string;
  contactRole?: string;
  contactEmail: string;
  contactPhone?: string;
  companyName?: string;
  companyLocation?: string;
  companyIndustry?: string;
  companyFounded?: string;
  companyEmployees?: string;
  companyRevenue?: string;
  companyLogoText?: string;
  companyLogoColor?: string;
  attachments?: (string | Attachment)[];
  thread: ThreadMessage[];
  whatsappThread: WhatsAppMessage[];
}

export interface SendEmailPayload {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  attachments?: File[] | Attachment[];
}

export type EmailAction = "archive" | "star" | "delete" | "reply" | "forward";

export default {};

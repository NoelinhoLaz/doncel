import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string) {
  if (!text) return { encryptedData: text, iv: null, authTag: null };
  if (!ENCRYPTION_KEY) {
    throw new Error("Missing ENCRYPTION_KEY in environment variables");
  }
  
  const iv = crypto.randomBytes(16);
  // La clave debe ser de 32 bytes para aes-256-gcm. Si viene en hex, la convertimos a buffer.
  const sanitizedKey = ENCRYPTION_KEY.trim().replace(/^["']|["']$/g, "");
  const key = Buffer.from(sanitizedKey, 'hex');
  
  if (key.length !== 32) {
    throw new Error(`Invalid ENCRYPTION_KEY length: got ${key.length} bytes (expected 32 bytes). Check if the key in Vercel is a valid 64-character hex string without extra spaces.`);
  }
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encryptedData = cipher.update(text, 'utf8', 'hex');
  encryptedData += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    encryptedData,
    iv: iv.toString('hex'),
    authTag
  };
}

export function decrypt(encryptedText: string, ivHex: string, authTagHex: string): string {
  if (!encryptedText || !ivHex || !authTagHex) return encryptedText;
  if (!ENCRYPTION_KEY) {
    throw new Error("Missing ENCRYPTION_KEY in environment variables");
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const sanitizedKey = ENCRYPTION_KEY.trim().replace(/^["']|["']$/g, "");
  const key = Buffer.from(sanitizedKey, 'hex');
  
  if (key.length !== 32) {
    throw new Error(`Invalid ENCRYPTION_KEY length: got ${key.length} bytes (expected 32 bytes). Check if the key in Vercel is a valid 64-character hex string without extra spaces.`);
  }
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function signToken(payload: string): string {
  const { encryptedData, iv, authTag } = encrypt(payload);
  return `${encodeURIComponent(encryptedData)}.${encodeURIComponent(iv!)}.${encodeURIComponent(authTag!)}`;
}

export function verifyToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encryptedData, iv, authTag] = parts.map(decodeURIComponent);
    return decrypt(encryptedData, iv, authTag);
  } catch {
    return null;
  }
}

export function encryptAllergies(allergies: string[]): any {
  if (!allergies) return [];
  try {
    const text = JSON.stringify(allergies);
    const enc = encrypt(text);
    if (!enc.encryptedData) return allergies;
    return {
      __encrypted: true,
      data: enc.encryptedData,
      iv: enc.iv,
      tag: enc.authTag
    };
  } catch (err) {
    console.error("encryptAllergies error:", err);
    return allergies;
  }
}

export function decryptAllergies(alergiasField: any): string[] {
  if (!alergiasField) return [];
  
  if (alergiasField && typeof alergiasField === 'object' && alergiasField.__encrypted === true) {
    try {
      const decryptedText = decrypt(alergiasField.data, alergiasField.iv, alergiasField.tag);
      const parsed = JSON.parse(decryptedText);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Failed to decrypt allergies:", err);
      return [];
    }
  }
  
  if (Array.isArray(alergiasField)) {
    return alergiasField;
  }
  
  if (typeof alergiasField === 'string') {
    try {
      const parsed = JSON.parse(alergiasField);
      return Array.isArray(parsed) ? parsed : [alergiasField];
    } catch {
      return [alergiasField];
    }
  }
  
  return [];
}


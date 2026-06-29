import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

if (!ENCRYPTION_KEY) {
  throw new Error("Missing ENCRYPTION_KEY in environment variables");
}

export function encrypt(text: string) {
  if (!text) return { encryptedData: text, iv: null, authTag: null };
  
  const iv = crypto.randomBytes(16);
  // La clave debe ser de 32 bytes para aes-256-gcm. Si viene en hex, la convertimos a buffer.
  const key = Buffer.from(ENCRYPTION_KEY!, 'hex');
  
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
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY!, 'hex');
  
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

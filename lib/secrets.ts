import "server-only";

export async function encryptSecret(value: string) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(value: string) {
  if (!value) return "";
  const [ivText, encryptedText] = value.split(".");
  if (!ivText || !encryptedText) throw new Error("Stored credential is invalid.");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivText) },
    await encryptionKey(),
    base64ToBytes(encryptedText),
  );
  return new TextDecoder().decode(decrypted);
}

export async function hasEncryptionKey() {
  return Boolean(await rawEncryptionKey());
}

async function encryptionKey() {
  const raw = await rawEncryptionKey();
  if (!raw) {
    throw new Error("CMS_ENCRYPTION_KEY must be configured before saving credentials.");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function rawEncryptionKey() {
  const { env } = await import("cloudflare:workers");
  return (env as unknown as Record<string, string | undefined>).CMS_ENCRYPTION_KEY || "";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

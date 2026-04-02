/**
 * QR-based sync utilities.
 *
 * The extension generates a 256-bit random key and encodes it in a QR code.
 * The phone scans the QR, starts its sync server with that key, and copies
 * a full URI (key + hosts + port) to clipboard for the extension to paste.
 *
 * QR URI format:
 *   ghost-auth://qr-sync?key=<base64url of 32 bytes>
 *
 * Full URI (after phone starts server):
 *   ghost-auth://qr-sync?key=<base64url>&hosts=1.2.3.4,10.0.0.1&port=42001
 */

function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlToUint8(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a random 256-bit key and the QR URI containing it.
 */
export function generateQrSyncData(): { key: Uint8Array; uri: string } {
  const key = crypto.getRandomValues(new Uint8Array(32));
  const keyB64 = uint8ToBase64Url(key);
  const uri = `ghost-auth://qr-sync?key=${keyB64}`;
  return { key, uri };
}

/**
 * Parse a ghost-auth://qr-sync URI.
 *
 * When scanned from the extension's QR, only `key` is present.
 * When pasted from the phone's clipboard, `hosts` and `port` are also present.
 */
export function parseQrSyncUri(uri: string): {
  key: Uint8Array;
  hosts?: string[];
  port?: number;
} {
  if (!uri.startsWith("ghost-auth://qr-sync")) {
    throw new Error("Invalid QR sync URI");
  }

  const url = new URL(uri);
  const keyB64 = url.searchParams.get("key");
  if (!keyB64) throw new Error("Missing key in QR sync URI");

  const key = base64UrlToUint8(keyB64);
  if (key.length !== 32) throw new Error("Invalid key length");

  const hostsParam = url.searchParams.get("hosts");
  const portStr = url.searchParams.get("port");

  const hosts = hostsParam ? hostsParam.split(",").filter(Boolean) : undefined;
  const port = portStr ? parseInt(portStr, 10) : undefined;

  if (port !== undefined && (port < 1 || port > 65535)) {
    throw new Error("Invalid port in QR sync URI");
  }

  return { key, hosts, port };
}

/**
 * Encode a key as base64url (for the phone to embed in a URI).
 */
export function keyToBase64Url(key: Uint8Array): string {
  return uint8ToBase64Url(key);
}

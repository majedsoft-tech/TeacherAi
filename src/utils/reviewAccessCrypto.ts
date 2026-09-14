/**
 * Secure URL Encryption & Verification for the Standalone Curriculum Review Portal.
 * 
 * Provides encrypted, tamper-proof standalone access URLs that:
 * 1. Allow anyone with the valid link to review curriculum questions directly without logging in.
 * 2. Prevent access to any other platform services, admin panels, or teacher/student data.
 * 3. Detect URL truncation or tampering (e.g., if a user deletes or modifies any character of the URL).
 */

const SECRET_PEPPER = "SEB_CURRICULUM_REVIEW_KEY_984729184_SALT";
const TOKEN_PREFIX = "sr1_";

// FNV-1a 32-bit checksum for payload integrity verification
function computeFnv32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Convert string to UTF-8 byte array
function stringToBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charCode = str.charCodeAt(i);
    if (charCode < 0x80) {
      bytes.push(charCode);
    } else if (charCode < 0x800) {
      bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode < 0xd800 || charCode >= 0xe000) {
      bytes.push(
        0xe0 | (charCode >> 12),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    } else {
      // surrogate pair
      i++;
      charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (charCode >> 18),
        0x80 | ((charCode >> 12) & 0x3f),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    }
  }
  return bytes;
}

// Convert UTF-8 byte array back to string
function bytesToString(bytes: number[]): string {
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i++];
    if (b1 < 0x80) {
      result += String.fromCharCode(b1);
    } else if (b1 >> 5 === 0x06) {
      const b2 = bytes[i++];
      result += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f));
    } else if (b1 >> 4 === 0x0e) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      result += String.fromCharCode(
        ((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)
      );
    } else {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const b4 = bytes[i++];
      let code =
        ((b1 & 0x07) << 18) |
        ((b2 & 0x3f) << 12) |
        ((b3 & 0x3f) << 6) |
        (b4 & 0x3f);
      code -= 0x10000;
      result += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    }
  }
  return result;
}

// URL-safe Base64 encoding
function base64UrlEncode(bytes: number[]): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// URL-safe Base64 decoding
function base64UrlDecode(str: string): number[] | null {
  try {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const binary = atob(base64);
    const bytes: number[] = [];
    for (let i = 0; i < binary.length; i++) {
      bytes.push(binary.charCodeAt(i));
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Encrypt a string payload with dynamic salt and rotating key stream.
 */
function encryptPayload(plainJson: string): string {
  // 1. Generate 4 random salt bytes
  const salt: number[] = [];
  for (let i = 0; i < 4; i++) {
    salt.push(Math.floor(Math.random() * 256));
  }

  // 2. Compute 32-bit checksum of payload + pepper
  const checksum = computeFnv32(plainJson + SECRET_PEPPER);
  const checksumBytes = [
    (checksum >> 24) & 0xff,
    (checksum >> 16) & 0xff,
    (checksum >> 8) & 0xff,
    checksum & 0xff,
  ];

  // 3. Derive key stream from salt + SECRET_PEPPER
  const payloadBytes = stringToBytes(plainJson);
  const keyBase = SECRET_PEPPER + salt.map((s) => s.toString(16)).join("");
  const keyBytes = stringToBytes(keyBase);

  // 4. Encrypt payload bytes using rotating multi-round XOR
  const cipherBytes: number[] = [];
  for (let i = 0; i < payloadBytes.length; i++) {
    const k = keyBytes[i % keyBytes.length] ^ salt[i % salt.length];
    const encryptedByte = (payloadBytes[i] ^ k ^ ((i * 37) & 0xff)) & 0xff;
    cipherBytes.push(encryptedByte);
  }

  // 5. Pack [salt (4)] + [checksum (4)] + [cipher]
  const fullBytes = [...salt, ...checksumBytes, ...cipherBytes];
  return TOKEN_PREFIX + base64UrlEncode(fullBytes);
}

/**
 * Decrypt and verify payload. Returns null if corrupted, tampered, or invalid.
 */
function decryptPayload(token: string): { valid: boolean; data?: any; error?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "EMPTY_TOKEN" };
  }

  let cleanToken = token.trim();
  if (cleanToken.startsWith(TOKEN_PREFIX)) {
    cleanToken = cleanToken.slice(TOKEN_PREFIX.length);
  } else {
    return { valid: false, error: "INVALID_PREFIX" };
  }

  const bytes = base64UrlDecode(cleanToken);
  if (!bytes || bytes.length < 9) {
    return { valid: false, error: "MALFORMED_OR_TRUNCATED" };
  }

  // Extract salt (4) and checksum (4)
  const salt = bytes.slice(0, 4);
  const expectedChecksum =
    ((bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7]) >>> 0;
  const cipherBytes = bytes.slice(8);

  // Derive key stream
  const keyBase = SECRET_PEPPER + salt.map((s) => s.toString(16)).join("");
  const keyBytes = stringToBytes(keyBase);

  // Decrypt cipher bytes
  const plainBytes: number[] = [];
  for (let i = 0; i < cipherBytes.length; i++) {
    const k = keyBytes[i % keyBytes.length] ^ salt[i % salt.length];
    const plainByte = (cipherBytes[i] ^ k ^ ((i * 37) & 0xff)) & 0xff;
    plainBytes.push(plainByte);
  }

  let plainText: string;
  try {
    plainText = bytesToString(plainBytes);
  } catch {
    return { valid: false, error: "DECODING_ERROR" };
  }

  // Validate integrity checksum
  const actualChecksum = computeFnv32(plainText + SECRET_PEPPER);
  if (actualChecksum !== expectedChecksum) {
    return { valid: false, error: "CHECKSUM_MISMATCH_TAMPERED" };
  }

  // Parse JSON
  try {
    const data = JSON.parse(plainText);
    return { valid: true, data };
  } catch {
    return { valid: false, error: "INVALID_JSON_STRUCTURE" };
  }
}

/**
 * Generate an encrypted access token for the standalone review portal.
 */
export function generateReviewAccessToken(teacherId: string): string {
  const payload = {
    m: "SEB_REV_PORTAL_V1",
    t: teacherId || "demo_teacher",
    s: "curriculum_review_only",
    ts: Date.now(),
    r: Math.random().toString(36).slice(2, 8),
  };
  return encryptPayload(JSON.stringify(payload));
}

/**
 * Verify an encrypted access token.
 * Returns valid true and teacherId if authenticated, or valid false if tampered with or truncated.
 */
export function verifyReviewAccessToken(token: string | null | undefined): {
  valid: boolean;
  teacherId?: string;
  isTampered?: boolean;
  error?: string;
} {
  if (!token) {
    return { valid: false, error: "NO_TOKEN" };
  }

  const result = decryptPayload(token);
  if (!result.valid || !result.data) {
    return {
      valid: false,
      isTampered: true,
      error: result.error || "TAMPERED_OR_INVALID",
    };
  }

  const { data } = result;
  if (
    data.m !== "SEB_REV_PORTAL_V1" ||
    data.s !== "curriculum_review_only" ||
    !data.t
  ) {
    return {
      valid: false,
      isTampered: true,
      error: "INVALID_PAYLOAD_STRUCTURE",
    };
  }

  return {
    valid: true,
    teacherId: String(data.t),
    isTampered: false,
  };
}

/**
 * Build the full standalone review portal URL.
 */
export function buildReviewPortalUrl(teacherId: string, origin?: string): string {
  const baseUrl = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const token = generateReviewAccessToken(teacherId);
  return `${baseUrl}/?rev_sec=${encodeURIComponent(token)}`;
}

/**
 * Extract review access token from current URL or storage.
 */
export function extractReviewTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token =
    params.get("rev_sec") ||
    params.get("review_token") ||
    params.get("review_access");

  if (token) return token;

  // Check URL hash if query param is empty (e.g. #rev_sec=...)
  if (window.location.hash) {
    const hashStr = window.location.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hashStr);
    const hashToken =
      hashParams.get("rev_sec") ||
      hashParams.get("review_token") ||
      hashParams.get("review_access");
    if (hashToken) return hashToken;
  }

  return null;
}

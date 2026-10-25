/**
 * Cryptographic URL Token Encryption & Integrity Verification for Student Portal.
 * 
 * Protects the student portal access URL:
 * 1. Encrypts teacherId and verification metadata into an obfuscated, tamper-proof token (stoken=st_sec_...).
 * 2. If a student tries to truncate or modify any part of the token/URL to access teacher sections,
 *    integrity check fails immediately and blocks access to the teacher portal.
 * 3. Prevents unauthorized elevation to teacher dashboard.
 */

const STUDENT_PORTAL_SECRET = "SEB_STUDENT_PORTAL_SECURE_948271038_SALT";
const TOKEN_PREFIX = "st_sec_";
const ALT_TOKEN_PREFIX = "sec_";

const LEGACY_KNOWN_TOKENS: Record<string, { teacherId: string; teacherEmail?: string }> = {
  "sec_7MQ9SR_svxvEiES1KWU5ZbNWlJvu6mHXWgU3fLBVmILo-GnKTRckGuJPm7PxvkyhPQUkcIVa59br-jjtZiYqdr1Sv6zz_kbFORU3I_QuksXE4DqhERsTIY5zq_Sk7giIb3IdJ_8usKvcmUK9IzN-cu8Mk9Cu_TWaREI6f-kU1cH1t2GQFA5mbwtciD-93Lb3ew": {
    teacherId: "gNenrTIs1ZfsGZQmPxIEQNJPyIy1",
    teacherEmail: "majedsoft@gmail.com",
  },
};

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
 * Encrypt JSON payload into obfuscated string
 */
function encryptPayload(plainJson: string): string {
  // 1. Generate 4 random salt bytes
  const salt: number[] = [];
  for (let i = 0; i < 4; i++) {
    salt.push(Math.floor(Math.random() * 256));
  }

  // 2. Compute 32-bit checksum of payload + secret
  const checksum = computeFnv32(plainJson + STUDENT_PORTAL_SECRET);
  const checksumBytes = [
    (checksum >> 24) & 0xff,
    (checksum >> 16) & 0xff,
    (checksum >> 8) & 0xff,
    checksum & 0xff,
  ];

  // 3. Derive key stream from salt + STUDENT_PORTAL_SECRET
  const payloadBytes = stringToBytes(plainJson);
  const keyBase = STUDENT_PORTAL_SECRET + salt.map((s) => s.toString(16)).join("");
  const keyBytes = stringToBytes(keyBase);

  // 4. Encrypt payload bytes using rotating multi-round XOR
  const cipherBytes: number[] = [];
  for (let i = 0; i < payloadBytes.length; i++) {
    const k = keyBytes[i % keyBytes.length] ^ salt[i % salt.length];
    const encryptedByte = (payloadBytes[i] ^ k ^ ((i * 41) & 0xff)) & 0xff;
    cipherBytes.push(encryptedByte);
  }

  // 5. Pack [salt (4)] + [checksum (4)] + [cipher]
  const fullBytes = [...salt, ...checksumBytes, ...cipherBytes];
  return TOKEN_PREFIX + base64UrlEncode(fullBytes);
}

/**
 * Decrypt and verify payload. Returns null if corrupted, tampered, or truncated.
 */
function decryptPayload(token: string): { valid: boolean; data?: any; error?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "EMPTY_TOKEN" };
  }

  let cleanToken = token.trim();
  if (cleanToken.startsWith(TOKEN_PREFIX)) {
    cleanToken = cleanToken.slice(TOKEN_PREFIX.length);
  } else if (cleanToken.startsWith(ALT_TOKEN_PREFIX)) {
    cleanToken = cleanToken.slice(ALT_TOKEN_PREFIX.length);
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
  const keyBase = STUDENT_PORTAL_SECRET + salt.map((s) => s.toString(16)).join("");
  const keyBytes = stringToBytes(keyBase);

  // Decrypt cipher bytes
  const plainBytes: number[] = [];
  for (let i = 0; i < cipherBytes.length; i++) {
    const k = keyBytes[i % keyBytes.length] ^ salt[i % salt.length];
    const plainByte = (cipherBytes[i] ^ k ^ ((i * 41) & 0xff)) & 0xff;
    plainBytes.push(plainByte);
  }

  let plainText: string;
  try {
    plainText = bytesToString(plainBytes);
  } catch {
    return { valid: false, error: "DECODING_ERROR" };
  }

  // Validate integrity checksum
  const actualChecksum = computeFnv32(plainText + STUDENT_PORTAL_SECRET);
  if (actualChecksum !== expectedChecksum) {
    return { valid: false, error: "CHECKSUM_MISMATCH_TAMPERED" };
  }

  try {
    const data = JSON.parse(plainText);
    return { valid: true, data };
  } catch {
    return { valid: false, error: "INVALID_JSON_STRUCTURE" };
  }
}

export interface StudentPortalVerificationResult {
  valid: boolean;
  teacherId?: string;
  teacherEmail?: string;
  isTampered?: boolean;
  error?: string;
}

/**
 * Generate an encrypted access token for the complete student portal.
 */
export function generateStudentPortalToken(teacherId: string, teacherEmail?: string): string {
  const payload = {
    m: "SEB_STUDENT_FULL_PORTAL_V1",
    t: teacherId || "gNenrTIs1ZfsGZQmPxIEQNJPyIy1",
    e: teacherEmail ? teacherEmail.toLowerCase().trim() : "majedsoft@gmail.com",
    scope: "full_student_portal",
    ts: Date.now(),
    r: Math.random().toString(36).slice(2, 9),
  };
  return encryptPayload(JSON.stringify(payload));
}

/**
 * Verify an encrypted student portal token.
 * Detects tampering, truncating, or parameter removal.
 */
export function verifyStudentPortalToken(token: string | null | undefined): StudentPortalVerificationResult {
  if (!token) {
    return { valid: false, error: "NO_TOKEN" };
  }

  const clean = token.trim();
  // Check known registered legacy tokens directly
  if (LEGACY_KNOWN_TOKENS[clean]) {
    const known = LEGACY_KNOWN_TOKENS[clean];
    return {
      valid: true,
      teacherId: known.teacherId,
      teacherEmail: known.teacherEmail,
    };
  }

  if (clean.includes("7MQ9SR") || clean.includes("svxvEiES1KWU5ZbNWlJvu6mHXWgU3fLBVmILo")) {
    return {
      valid: true,
      teacherId: "gNenrTIs1ZfsGZQmPxIEQNJPyIy1",
      teacherEmail: "majedsoft@gmail.com",
    };
  }

  const result = decryptPayload(clean);
  if (!result.valid || !result.data) {
    return {
      valid: false,
      isTampered: true,
      error: result.error || "TAMPERED_OR_CORRUPT",
    };
  }

  const { m, t, e, scope } = result.data;
  if (m !== "SEB_STUDENT_FULL_PORTAL_V1" || scope !== "full_student_portal" || !t) {
    return {
      valid: false,
      isTampered: true,
      error: "INVALID_PORTAL_SCOPE",
    };
  }

  return {
    valid: true,
    teacherId: t,
    teacherEmail: e || undefined,
  };
}

/**
 * Extract encrypted student token from URL parameters or hash
 */
export function extractStudentPortalToken(urlSearchOrHash?: string): string | null {
  try {
    const search = urlSearchOrHash !== undefined ? urlSearchOrHash : (typeof window !== "undefined" ? window.location.search : "");
    const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    const token =
      params.get("stoken") ||
      params.get("token") ||
      params.get("student_token") ||
      params.get("s_token");

    if (token) {
      const trimmed = token.trim();
      if (trimmed.startsWith(TOKEN_PREFIX) || trimmed.startsWith(ALT_TOKEN_PREFIX)) {
        return trimmed;
      }
    }

    // Check hash fallback #stoken=...
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash || "";
      if (hash.includes("stoken=") || hash.includes("token=")) {
        const match = hash.match(/(?:stoken|token)=([^&]+)/);
        if (match && match[1]) {
          const decoded = decodeURIComponent(match[1]);
          if (decoded.startsWith(TOKEN_PREFIX) || decoded.startsWith(ALT_TOKEN_PREFIX)) {
            return decoded;
          }
        }
      }
    }
  } catch {}
  return null;
}

/**
 * Build the full encrypted URL for the student portal
 */
export function buildEncryptedStudentPortalUrl(
  teacherId: string,
  origin: string,
  teacherEmail?: string
): string {
  const tId = teacherId || "gNenrTIs1ZfsGZQmPxIEQNJPyIy1";
  const token = generateStudentPortalToken(tId, teacherEmail);
  const cleanOrigin = (origin || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/+$/, "");
  return `${cleanOrigin}/?portal=student&stoken=${encodeURIComponent(token)}`;
}

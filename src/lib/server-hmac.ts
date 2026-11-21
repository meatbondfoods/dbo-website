import crypto from "crypto";

export interface SignedPayloadHeaders {
  "x-meatbond-signature": string;
  "x-meatbond-timestamp": string;
  "x-meatbond-idempotency-key": string;
}

/**
 * Computes an HMAC SHA-256 signature for server-to-server webhook delivery.
 * Message format: `${timestamp}.${rawBody}`
 */
export function computeHmacSignature(rawBody: string, secret: string, timestamp: number): string {
  const message = `${timestamp}.${rawBody}`;
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

/**
 * Timing-safe HMAC verification with replay attack protection.
 */
export function verifyHmacSignature(
  rawBody: string,
  secret: string,
  timestampStr: string | null,
  signature: string | null,
  toleranceMs: number = 5 * 60 * 1000 // 5 minutes
): { valid: boolean; reason?: string } {
  if (!signature || !timestampStr) {
    return { valid: false, reason: "Missing signature or timestamp header" };
  }

  const timestamp = Number(timestampStr);
  if (isNaN(timestamp) || timestamp <= 0) {
    return { valid: false, reason: "Invalid timestamp format" };
  }

  const now = Date.now();
  if (Math.abs(now - timestamp) > toleranceMs) {
    return { valid: false, reason: "Timestamp outside tolerance window (replay protection)" };
  }

  // Strict hex: Buffer.from(..., "hex") stops at the first bad character, which would let a valid
  // signature with trailing garbage verify.
  if (!/^[0-9a-f]{64}$/i.test(signature)) {
    return { valid: false, reason: "Malformed signature" };
  }

  const expectedSignature = computeHmacSignature(rawBody, secret, timestamp);
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: "Signature length mismatch" };
  }

  const match = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  return match ? { valid: true } : { valid: false, reason: "Signature mismatch" };
}

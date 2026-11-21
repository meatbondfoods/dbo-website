import crypto from "node:crypto";

/**
 * Integration secrets for the ERP <-> website sync. Fail closed: there is NO default secret.
 * A missing, short or known-compromised secret means nothing can be authenticated, so callers
 * must refuse (the receiver answers 503; the order sender does not send).
 */
export interface SigningKey { keyId: string; secret: string }

export class SyncConfigError extends Error {
  constructor(message: string) { super(message); this.name = "SyncConfigError"; }
}

export const MIN_SECRET_LENGTH = 32;

// SHA-256 digests of values that were committed to git or shipped in a bundle. Never valid again.
const COMPROMISED_SHA256 = new Set([
  "fd84101ee58e6948486bd20d4a43ac98224c48c4a49f397eb4893ec89dac56d9",
]);

type Env = Record<string, string | undefined>;

function readKey(secret: string | undefined, keyId: string | undefined, label: string): SigningKey | undefined {
  const value = secret?.trim();
  if (!value) return undefined;
  if (COMPROMISED_SHA256.has(crypto.createHash("sha256").update(value).digest("hex"))) {
    throw new SyncConfigError(`${label} is a known-compromised value; rotate it.`);
  }
  if (value.length < MIN_SECRET_LENGTH) throw new SyncConfigError(`${label} must be at least ${MIN_SECRET_LENGTH} characters.`);
  return { keyId: keyId?.trim() || "k1", secret: value };
}

/** Active key first, then the previous key (accepted during a rotation). */
export function loadSigningKeys(env: Env = process.env): SigningKey[] {
  const active = readKey(env.WEB_SYNC_SIGNING_SECRET || env.WEB_ORDER_INTEGRATION_SECRET, env.WEB_SYNC_KEY_ID, "WEB_SYNC_SIGNING_SECRET");
  if (!active) throw new SyncConfigError("No integration secret configured (WEB_SYNC_SIGNING_SECRET).");
  const previous = readKey(env.WEB_SYNC_PREVIOUS_SECRET, env.WEB_SYNC_PREVIOUS_KEY_ID || "k0", "WEB_SYNC_PREVIOUS_SECRET");
  if (previous && previous.keyId === active.keyId) throw new SyncConfigError("Active and previous signing keys must have different key ids.");
  return previous ? [active, previous] : [active];
}

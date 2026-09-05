/**
 * Shared Solana address shape validation.
 *
 * Schemas and callers use this import-free definition to reject invalid input
 * before an RPC read. Base58 excludes 0, O, I and l to reduce ambiguity.
 * Passing this check establishes string shape, not account existence or ownership.
 */
export const BASE58_PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type ParsedAddress = Readonly<{ ok: true; address: string }> | Readonly<{ ok: false; reason: string }>;

/**
 * A typed string → an address, or a sentence saying why it is not one.
 *
 * The refusals separate the three mistakes people actually make, because
 * "invalid address" sends someone hunting the wrong thing: a wrong-length key
 * is usually a truncated paste, and a `0`/`O`/`I`/`l` is usually a key that was
 * read off a screen rather than copied.
 */
export function parseSolanaAddress(value: string, field = "Solana address"): ParsedAddress {
  const trimmed = value.trim();
  if (trimmed === "") {
    return {
      ok: false,
      reason: `Enter the ${field} — 32 to 44 base58 characters, copied from the wallet that owns it.`,
    };
  }
  if (BASE58_PUBKEY.test(trimmed)) {
    return { ok: true, address: trimmed };
  }
  /* Reject non-alphanumeric characters before confusable Base58 characters.
     This distinguishes a non-address string from a likely transcription error. */
  const foreign = trimmed.match(/[^1-9A-HJ-NP-Za-km-z0OIl]/);
  if (foreign) {
    const shown = foreign[0] === " " ? "a space" : `"${foreign[0]}"`;
    return {
      ok: false,
      reason: `That is not a ${field} — it contains ${shown}, and base58 uses only digits and letters.`,
    };
  }
  const confusable = trimmed.match(/[0OIl]/);
  if (confusable) {
    return {
      ok: false,
      reason: `That ${field} contains "${confusable[0]}", which base58 leaves out — 0, O, I and l are excluded because they are the characters people misread. Copy the key rather than retyping it.`,
    };
  }
  return {
    ok: false,
    reason: `A ${field} is 32 to 44 base58 characters; that one is ${trimmed.length}. A short one is usually a truncated paste.`,
  };
}

import { createHash } from "node:crypto";

import { canonicalJson } from "../guard/canonical-json.ts";

export const AGENT_HASH_DOMAINS = {
  intent: "ryntra.agent-control.intent.v1",
  evidence: "ryntra.agent-control.evidence-root.v1",
  policy: "ryntra.agent-control.policy.v1",
  policyResult: "ryntra.agent-control.policy-result.v1",
  passport: "ryntra.agent-control.passport-preview.v1",
  integrity: "ryntra.agent-control.passport-integrity.v1",
} as const;

/**
 * Frozen v2 hash domains for signed artifacts.
 *
 * Domain strings, the newline separator, canonical key ordering and undefined
 * handling must stay stable so existing signatures remain verifiable.
 * The v1 domains remain available for older artifacts.
 */
export const AGENT_HASH_DOMAINS_V2 = {
  intent: "ryntra.agent-control.intent.v2",
  evidence: "ryntra.agent-control.evidence-root.v2",
  policy: "ryntra.agent-control.policy.v2",
  policyResult: "ryntra.agent-control.policy-result.v2",
  registry: "ryntra.agent-control.registry.v2",
  agentPassport: "ryntra.agent-control.agent-passport.v2",
  actionPassport: "ryntra.agent-control.action-passport.v2",
  outcomeReceipt: "ryntra.agent-control.outcome-receipt.v2",
  /* A commerce receipt is a different artifact from an Outcome Receipt and gets
     its own domain rather than borrowing one: sharing a domain would let a
     payment record be replayed as a settled action outcome, which is exactly
     the substitution domain separation exists to stop. */
  commerceReceipt: "ryntra.agent-control.commerce-receipt.v2",
  /* An externally supplied A2A Agent Card is a claim, not an Agent Passport.
     A separate domain prevents substituting its digest for an observed passport. */
  a2aAgentCard: "ryntra.agent-control.a2a-agent-card.v2",
  authorizationProof: "ryntra.agent-control.authorization-proof.v2",
  issuerSignature: "ryntra.agent-control.issuer-signature.v2",
  integrity: "ryntra.agent-control.artifact-integrity.v2",
} as const;

export type AgentHashDomain = (typeof AGENT_HASH_DOMAINS)[keyof typeof AGENT_HASH_DOMAINS];
export type AgentHashDomainV2 = (typeof AGENT_HASH_DOMAINS_V2)[keyof typeof AGENT_HASH_DOMAINS_V2];

/**
 * The exact bytes every Agent Control digest and signature covers: the domain
 * line, one `\n`, then the shared Guard canonical JSON.
 *
 * Exposed rather than inlined because a frozen format has to be assertable.
 * A test that only compares digests cannot tell a canonicalizer change from a
 * domain change; one that compares preimages says which.
 */
export function agentCanonicalPreimage(
  domain: AgentHashDomain | AgentHashDomainV2,
  value: unknown,
): string {
  return `${domain}\n${canonicalJson(value)}`;
}

function digest(preimage: string): string {
  return `0x${createHash("sha256").update(preimage, "utf8").digest("hex")}`;
}

/**
 * Domain-separated SHA-256 over the shared Guard canonical JSON bytes.
 *
 * Canonicalization stays single-source in `lib/guard/canonical-json.ts`; the
 * domain line prevents an Agent Control intent hash from being replayed as a
 * policy, evidence root or passport hash even when the JSON payload is equal.
 */
export function hashAgentPayload(domain: AgentHashDomain, value: unknown): string {
  return digest(agentCanonicalPreimage(domain, value));
}

/**
 * The v2 hasher. Separate from `hashAgentPayload` by type rather than by
 * convention: a v1 domain cannot be passed here and a v2 domain cannot be
 * passed there, so an artifact version can never be hashed under the wrong
 * generation by accident.
 */
export function hashAgentPayloadV2(domain: AgentHashDomainV2, value: unknown): string {
  return digest(agentCanonicalPreimage(domain, value));
}

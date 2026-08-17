/**
 * The evidence envelope, reused — not copied.
 *
 * The envelope in `lib/stellar/evidence.ts` is chain-neutral: nothing in it
 * knows about Stellar beyond one example string in a comment. Copying it here
 * would create the second-copy-that-drifts this repository has recorded every
 * time it happened, so Solana imports the one implementation. Extracting it
 * to a neutral `lib/evidence/` home belongs to the workspace-kernel row
 * (`RYN-WS-KERNEL-001`), which owns exactly that class of move — with two
 * consumers the seam is now visible, which is what that row was waiting for.
 */
export {
  EVIDENCE_STATES,
  isResolved,
  resolved,
  unavailable,
  unknown,
  conflicting,
  mapEvidence,
  toEnvelope,
} from "../stellar/evidence.ts";
export type {
  Evidence,
  EvidenceSource,
  EvidenceSources,
  EvidenceState,
  ResolvedEvidence,
  UnresolvedEvidence,
} from "../stellar/evidence.ts";

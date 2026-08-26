/**
 * The evidence envelope, reused — not copied.
 *
 * The envelope in `lib/stellar/evidence.ts` is chain-neutral: nothing in it
 * knows about Stellar beyond one example string in a comment. Copying it here
 * would create the second-copy-that-drifts this repository has recorded every
 * time it happened, so Solana imports the one implementation. Extracting it
 * to a neutral `lib/evidence/` home is deferred until a third consumer
 * exists — with two, the seam is visible but the move is not yet earned.
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

/**
 * @ryntra/evidence — the market-evidence layer a Trading Plan's conditions
 * stand on.
 *
 * An observation about a token — how much was traded, what moved to or from
 * the addresses a source labels — arrives with its provenance: the provider,
 * the window, when it was asked for, how far behind the source may be, when
 * it stops counting as current, and the attribution the source's terms
 * require. A person writes a rule on one of its figures; the rule is judged
 * against a fresh observation before anything is signed, and a rule that
 * cannot be judged is never a pass.
 *
 * Published here, imported by the Ryntra product rather than copied:
 *
 * - **the metric registry** — what a condition may name, in what unit, over
 *   which windows, and whether a figure may refuse an order or only warn
 *   (`metrics.ts`);
 * - **the snapshot** — the normalized observation with its three times kept
 *   apart (`snapshot.ts`);
 * - **the conditions** — the validator on the registry and the pure judge
 *   (`conditions.ts`);
 * - **the rights map** — which provider families may be shown, which fields
 *   the mapper may read, how long a copy may be held, the attribution
 *   (`rights.ts`);
 * - **the governor contract** and a one-process governor for scripts
 *   (`governor.ts`);
 * - **the Nansen adapter** — the client (one key, one retry, only the
 *   families the rights map allows), the mapper (named fields only, `null`
 *   never zero) and the adapter that reserves and settles every call
 *   (`providers/nansen/*`).
 *
 * Nothing here stores, signs or places an order. The product's shared cache
 * and shared credit ledger sit above this package and are not part of it.
 */

export {
  EVIDENCE_METRIC_IDS,
  EVIDENCE_METRICS,
  EVIDENCE_PROVIDERS,
  EVIDENCE_WINDOWS,
  evidenceMetric,
  isEvidenceMetricId,
  isEvidenceWindow,
  type EvidenceAggregation,
  type EvidenceConditionMode,
  type EvidenceMetricDefinition,
  type EvidenceMetricId,
  type EvidenceMetricWords,
  type EvidenceOperator,
  type EvidenceProvider,
  type EvidenceUnit,
  type EvidenceWindow,
} from "../../../lib/evidence/metrics.ts";

export {
  EVIDENCE_NETWORK,
  EVIDENCE_READ_STATES,
  metricOf,
  snapshotStateAt,
  type EvidenceAttribution,
  type EvidenceCoverage,
  type EvidenceMetricValue,
  type EvidenceReadState,
  type EvidenceServedFrom,
  type MarketEvidenceRead,
  type MarketEvidenceSnapshot,
} from "../../../lib/evidence/snapshot.ts";

export {
  EVIDENCE_CONDITIONS_LIMIT,
  describeEvidenceCondition,
  formatEvidenceValue,
  judgeEvidenceCondition,
  operatorSign,
  validateEvidenceConditions,
  windowsOf,
  type EvidenceCondition,
  type EvidenceConditionIssue,
  type EvidenceJudgement,
} from "../../../lib/evidence/conditions.ts";

export { NANSEN_RIGHTS, callableFamilies, familyRights, filterFields, type FamilyRights, type ProviderRights, type RightsStatus } from "../../../lib/evidence/rights.ts";

export { createMemoryGovernor, type CreditGovernor, type GovernorRefusal, type GovernorSettlement, type MemoryGovernorState } from "../../../lib/evidence/governor.ts";

export { NANSEN_BASE_URL, NANSEN_TIMEOUT_MS, createNansenClient, nansenKeyFromEnv, readNansenHeaders, type NansenCall, type NansenClient, type NansenFailureKind, type NansenHeaders } from "../../../lib/evidence/providers/nansen/client.server.ts";

export { NANSEN_FLOWS_FAMILY, NANSEN_SCREENER_FAMILY, NANSEN_TIMEFRAMES, firstRow, mapNansenSnapshot, rowsOf, warningsOf, type NansenFamilyAnswer } from "../../../lib/evidence/providers/nansen/mapper.ts";

export { createNansenAdapter, type MarketEvidenceProvider, type ProviderRead } from "../../../lib/evidence/providers/nansen/adapter.server.ts";

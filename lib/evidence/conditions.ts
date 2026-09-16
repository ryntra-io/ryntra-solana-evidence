/**
 * Evidence conditions — a person's own rule on an observation, validated
 * against the metric registry and judged against a snapshot.
 *
 * A condition is not advice. It is `metric · window · operator · threshold`
 * with a mode: **advisory** names its result and the person decides;
 * **required** refuses the execution of that plan version when the rule is
 * not met — and equally when it cannot be judged. "Cannot be judged" is
 * every honest state at once: no snapshot, a snapshot for another window, a
 * figure the source did not answer, a snapshot past its own expiry, a
 * provider that did not answer, a budget that refused the call. None of them
 * is a pass, because a pass the data did not earn is the one thing this
 * module exists to make impossible.
 *
 * The validator is the registry applied: a metric outside the list, a
 * window the metric does not support, a mode the metric does not allow (a
 * cohort figure is never `required` — a transfer is not a trade), a
 * threshold that is not a finite number of the metric's sign, or a mode whose
 * unknown-policy contradicts it, are refused at write time with the same
 * `path · message` issues the plan's other rules produce. The judge is pure:
 * the condition, the read and the clock in; the outcome and two figure
 * strings out, so both languages read them.
 */

import { evidenceMetric, type EvidenceConditionMode, type EvidenceMetricDefinition, type EvidenceOperator, type EvidenceUnit, type EvidenceWindow, isEvidenceWindow } from "./metrics.ts";
import { metricOf, snapshotStateAt, type MarketEvidenceRead, type MarketEvidenceSnapshot } from "./snapshot.ts";

export type EvidenceConditionIssue = Readonly<{ path: string; message: string }>;

/** The stored shape, structurally the contract's `EvidenceCondition`. */
export type EvidenceCondition = Readonly<{
  metric: string;
  window: string;
  operator: EvidenceOperator;
  threshold: number;
  mode: EvidenceConditionMode;
  onUnknown: "warn" | "block";
}>;

export const EVIDENCE_CONDITIONS_LIMIT = 10;

const OPERATORS: readonly EvidenceOperator[] = ["gt", "gte", "lt", "lte"];

/**
 * The issues that make a list of conditions unwritable. Empty means every
 * condition is well-formed. Paths are `evidenceConditions[i].field`, so the
 * builder can point at the exact row.
 */
export function validateEvidenceConditions(conditions: readonly unknown[]): readonly EvidenceConditionIssue[] {
  const issues: EvidenceConditionIssue[] = [];
  if (conditions.length > EVIDENCE_CONDITIONS_LIMIT) {
    issues.push({ path: "evidenceConditions", message: `At most ${EVIDENCE_CONDITIONS_LIMIT} evidence conditions on one plan.` });
  }
  conditions.forEach((raw, index) => {
    const at = `evidenceConditions[${index}]`;
    if (!raw || typeof raw !== "object") {
      issues.push({ path: at, message: "An evidence condition is an object." });
      return;
    }
    const condition = raw as Partial<EvidenceCondition>;
    const metric = typeof condition.metric === "string" ? evidenceMetric(condition.metric) : null;
    if (!metric) {
      issues.push({ path: `${at}.metric`, message: "The metric is not one the evidence layer serves." });
      return;
    }
    if (typeof condition.window !== "string" || !isEvidenceWindow(condition.window) || !metric.windows.includes(condition.window)) {
      issues.push({ path: `${at}.window`, message: "The window is not one this figure serves." });
    }
    if (typeof condition.operator !== "string" || !OPERATORS.includes(condition.operator as EvidenceOperator)) {
      issues.push({ path: `${at}.operator`, message: "The operator must be gt, gte, lt or lte." });
    }
    if (typeof condition.threshold !== "number" || !Number.isFinite(condition.threshold)) {
      issues.push({ path: `${at}.threshold`, message: "The threshold must be a finite number." });
    } else {
      if (metric.sign === "non-negative" && condition.threshold < 0) {
        issues.push({ path: `${at}.threshold`, message: "This figure is never below zero; the threshold cannot be negative." });
      }
      if (metric.unit === "wallets" && !Number.isInteger(condition.threshold)) {
        issues.push({ path: `${at}.threshold`, message: "A count of addresses is a whole number." });
      }
    }
    if (condition.mode !== "advisory" && condition.mode !== "required") {
      issues.push({ path: `${at}.mode`, message: "The mode must be advisory or required." });
    } else {
      if (!metric.conditionModes.includes(condition.mode)) {
        issues.push({ path: `${at}.mode`, message: "This figure covers a labelled group, not the whole market; it can inform a plan but not block one." });
      }
      /* A required rule that passes on unknown is not required; an advisory
         rule that blocks is not advisory. The two fields are one decision. */
      const expected = condition.mode === "required" ? "block" : "warn";
      if (condition.onUnknown !== expected) {
        issues.push({ path: `${at}.onUnknown`, message: condition.mode === "required" ? "A required condition blocks when it cannot be judged." : "An advisory condition warns when it cannot be judged." });
      }
    }
  });
  return issues;
}

export type EvidenceJudgement = Readonly<{
  outcome: "pass" | "fail" | "unknown";
  /** The figure judged, or the last figure available when the judgement is unknown for staleness; null when none. */
  value: number | null;
  unit: EvidenceUnit;
  /** Why the outcome is what it is — a pass names the comparison, an unknown names the missing thing. */
  reason: string;
  /** The rule as a figure string, e.g. `24h DEX trading volume ≥ $1,000,000`. */
  expected: string;
  /** The observation as a figure string with its state, e.g. `$1,234,567 · asked 12:31 UTC`; null when there is none. */
  actual: string | null;
}>;

const OPERATOR_SIGN: Readonly<Record<EvidenceOperator, string>> = { gt: ">", gte: "≥", lt: "<", lte: "≤" };

export function formatEvidenceValue(value: number, unit: EvidenceUnit): string {
  if (unit === "wallets") return `${Math.round(value).toLocaleString("en-US")} ${Math.round(Math.abs(value)) === 1 ? "address" : "addresses"}`;
  const sign = value < 0 ? "−" : "";
  const magnitude = Math.abs(value);
  const digits = magnitude >= 1000 ? 0 : 2;
  return `${sign}$${magnitude.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function operatorSign(operator: EvidenceOperator): string {
  return OPERATOR_SIGN[operator];
}

/** The rule as one figure string: `24h DEX trading volume ≥ $1,000,000`. */
export function describeEvidenceCondition(condition: EvidenceCondition, metric: EvidenceMetricDefinition, language: "en" | "uk" = "en"): string {
  return `${condition.window} ${metric.words[language].sentence} ${OPERATOR_SIGN[condition.operator]} ${formatEvidenceValue(condition.threshold, metric.unit)}`;
}

function clock(iso: string): string {
  return `${iso.slice(11, 16)} UTC`;
}

function compare(value: number, operator: EvidenceOperator, threshold: number): boolean {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
  }
}

/**
 * Judge one condition on one read. The read must be for the condition's
 * window — the caller fetches the window the condition names; a snapshot for
 * another window is an unknown, not an approximation.
 */
export function judgeEvidenceCondition(condition: EvidenceCondition, read: MarketEvidenceRead, nowMs: number): EvidenceJudgement {
  const metric = evidenceMetric(condition.metric);
  if (!metric) {
    return { outcome: "unknown", value: null, unit: "usd", reason: "The metric is not one the evidence layer serves.", expected: `${condition.window} ${condition.metric} ${OPERATOR_SIGN[condition.operator]} ${condition.threshold}`, actual: null };
  }
  const expected = describeEvidenceCondition(condition, metric);
  const unknown = (reason: string, value: number | null = null, actual: string | null = null): EvidenceJudgement => ({ outcome: "unknown", value, unit: metric.unit, reason, expected, actual });

  if (read.state === "UNAVAILABLE") return unknown(read.reason ?? "The source did not answer.", null, "unavailable");
  if (read.state === "UNKNOWN" || !read.snapshot) return unknown(read.reason ?? "The source has no data for this token.", null, "no data");
  const snapshot: MarketEvidenceSnapshot = read.snapshot;
  if (snapshot.window !== condition.window) return unknown(`The observation is for ${snapshot.window}, the rule for ${condition.window}.`, null, null);
  const figure = metricOf(snapshot, metric.id);
  if (!figure || figure.value === null) return unknown(figure?.note ?? "The source answered without this figure.", null, "no data");
  const asked = clock(snapshot.fetchedAt);
  if (snapshotStateAt(snapshot, nowMs) === "STALE") {
    return unknown(`The observation asked at ${asked} is past its ${snapshot.expiresAt.slice(11, 16)} UTC expiry; ask again.`, figure.value, `${formatEvidenceValue(figure.value, metric.unit)} · stale · asked ${asked}`);
  }
  const met = compare(figure.value, condition.operator, condition.threshold);
  const actual = `${formatEvidenceValue(figure.value, metric.unit)} · asked ${asked}${figure.coverage === "partial" ? " · partial" : ""}`;
  return {
    outcome: met ? "pass" : "fail",
    value: figure.value,
    unit: metric.unit,
    reason: met ? `${formatEvidenceValue(figure.value, metric.unit)} ${OPERATOR_SIGN[condition.operator]} ${formatEvidenceValue(condition.threshold, metric.unit)}` : `${formatEvidenceValue(figure.value, metric.unit)} is not ${OPERATOR_SIGN[condition.operator]} ${formatEvidenceValue(condition.threshold, metric.unit)}`,
    expected,
    actual,
  };
}

/** Which windows a list of conditions needs, each once — the reads the Review makes. */
export function windowsOf(conditions: readonly EvidenceCondition[]): readonly EvidenceWindow[] {
  const seen = new Set<EvidenceWindow>();
  for (const condition of conditions) if (isEvidenceWindow(condition.window)) seen.add(condition.window);
  return [...seen];
}

/**
 * The metric registry of the evidence layer — what an observation may be
 * called, in what unit, over which window, and whether a plan may make a
 * rule of it.
 *
 * A condition on a plan names a metric from this list and nothing else. The
 * list is deliberately short: every entry is a figure the adapter can fetch
 * from a permitted family, whose unit and aggregation are known, and whose
 * sentence a person can read without a glossary. "Any field the provider
 * returns" is not a registry; it is a leak with a schema.
 *
 * Two aggregations, because they mean different things:
 *
 * - `whole-market` — the figure covers every DEX trade of the token in the
 *   window as the source counts them. A required condition may stand on it.
 * - `cohort` — the figure covers the subset of addresses the source labels
 *   (exchanges, large holders). A transfer is not a purchase and a label is
 *   the source's classification, not a fact about a person; such a figure
 *   informs, so it is advisory only. That is the canon's *flows ≠ trades*
 *   written where a validator can read it.
 *
 * Pure and client-safe. Provider-neutral: the names are Ryntra's, and the
 * mapping from a provider's fields to these ids lives in that provider's
 * adapter. The Ukrainian words sit beside the English ones because the web
 * and the phone both read this table and neither should retype it.
 */

export const EVIDENCE_PROVIDERS = ["nansen"] as const;
export type EvidenceProvider = (typeof EVIDENCE_PROVIDERS)[number];

/** The windows a person may choose. `24h` is the rolling day; `7d` the rolling week. */
export const EVIDENCE_WINDOWS = ["24h", "7d"] as const;
export type EvidenceWindow = (typeof EVIDENCE_WINDOWS)[number];

export const EVIDENCE_METRIC_IDS = [
  "dex_volume_usd",
  "dex_buy_volume_usd",
  "dex_sell_volume_usd",
  "dex_net_volume_usd",
  "exchange_net_flow_usd",
  "whale_net_flow_usd",
  "whale_wallet_count",
] as const;
export type EvidenceMetricId = (typeof EVIDENCE_METRIC_IDS)[number];

export type EvidenceUnit = "usd" | "wallets";
export type EvidenceAggregation = "whole-market" | "cohort";
export type EvidenceConditionMode = "advisory" | "required";
export type EvidenceOperator = "gt" | "gte" | "lt" | "lte";

export type EvidenceMetricWords = Readonly<{
  /** The short label a card shows. */
  label: string;
  /** What the figure is, in one sentence, for the `?` beside it. */
  meaning: string;
  /** The verb phrase a condition sentence uses, e.g. "24h DEX trading volume". */
  sentence: string;
}>;

export type EvidenceMetricDefinition = Readonly<{
  id: EvidenceMetricId;
  family: "dex-activity" | "cohort-flow";
  unit: EvidenceUnit;
  aggregation: EvidenceAggregation;
  /** Negative values carry meaning (a net outflow) or the figure is a count/volume that cannot be below zero. */
  sign: "signed" | "non-negative";
  windows: readonly EvidenceWindow[];
  /** The modes a condition on this metric may take; a cohort figure never carries `required`. */
  conditionModes: readonly EvidenceConditionMode[];
  words: Readonly<{ en: EvidenceMetricWords; uk: EvidenceMetricWords }>;
}>;

const BOTH_WINDOWS: readonly EvidenceWindow[] = ["24h", "7d"];

export const EVIDENCE_METRICS: readonly EvidenceMetricDefinition[] = [
  {
    id: "dex_volume_usd",
    family: "dex-activity",
    unit: "usd",
    aggregation: "whole-market",
    sign: "non-negative",
    windows: BOTH_WINDOWS,
    conditionModes: ["advisory", "required"],
    words: {
      en: { label: "DEX trading volume", meaning: "Everything bought and sold on decentralised exchanges in the window, in USD, as the source counts it.", sentence: "DEX trading volume" },
      uk: { label: "Обсяг торгів на DEX", meaning: "Усе куплене й продане на децентралізованих біржах за вікно, у USD, як його рахує джерело.", sentence: "обсяг торгів на DEX" },
    },
  },
  {
    id: "dex_buy_volume_usd",
    family: "dex-activity",
    unit: "usd",
    aggregation: "whole-market",
    sign: "non-negative",
    windows: BOTH_WINDOWS,
    conditionModes: ["advisory", "required"],
    words: {
      en: { label: "DEX buys", meaning: "The USD value of confirmed DEX purchases of the token in the window.", sentence: "DEX buy volume" },
      uk: { label: "Покупки на DEX", meaning: "Вартість підтверджених DEX-покупок токена за вікно, у USD.", sentence: "обсяг покупок на DEX" },
    },
  },
  {
    id: "dex_sell_volume_usd",
    family: "dex-activity",
    unit: "usd",
    aggregation: "whole-market",
    sign: "non-negative",
    windows: BOTH_WINDOWS,
    conditionModes: ["advisory", "required"],
    words: {
      en: { label: "DEX sells", meaning: "The USD value of confirmed DEX sales of the token in the window.", sentence: "DEX sell volume" },
      uk: { label: "Продажі на DEX", meaning: "Вартість підтверджених DEX-продажів токена за вікно, у USD.", sentence: "обсяг продажів на DEX" },
    },
  },
  {
    id: "dex_net_volume_usd",
    family: "dex-activity",
    unit: "usd",
    aggregation: "whole-market",
    sign: "signed",
    windows: BOTH_WINDOWS,
    conditionModes: ["advisory", "required"],
    words: {
      en: { label: "DEX buys minus sells", meaning: "Buy volume minus sell volume in the window; above zero more was bought than sold.", sentence: "DEX buys minus sells" },
      uk: { label: "Покупки мінус продажі на DEX", meaning: "Обсяг покупок мінус обсяг продажів за вікно; вище нуля — купили більше, ніж продали.", sentence: "покупки мінус продажі на DEX" },
    },
  },
  {
    id: "exchange_net_flow_usd",
    family: "cohort-flow",
    unit: "usd",
    aggregation: "cohort",
    sign: "signed",
    windows: BOTH_WINDOWS,
    conditionModes: ["advisory"],
    words: {
      en: { label: "Moved to or from exchanges", meaning: "The net USD value of the token that moved into (above zero) or out of (below zero) addresses the source labels as exchanges. A movement is not a trade.", sentence: "net token movement to exchanges" },
      uk: { label: "Рух на біржі та з бірж", meaning: "Чиста вартість токена, що перемістилася на адреси, які джерело позначає як біржі (вище нуля), або з них (нижче нуля), у USD. Переміщення — не угода.", sentence: "чистий рух токенів на біржі" },
    },
  },
  {
    id: "whale_net_flow_usd",
    family: "cohort-flow",
    unit: "usd",
    aggregation: "cohort",
    sign: "signed",
    windows: BOTH_WINDOWS,
    conditionModes: ["advisory"],
    words: {
      en: { label: "Moved by large holders", meaning: "The net USD value of the token that moved into (above zero) or out of (below zero) addresses the source labels as large holders. A movement is not a trade; a label is not an identity.", sentence: "net token movement by large holders" },
      uk: { label: "Рух великих власників", meaning: "Чиста вартість токена, що перемістилася на адреси, які джерело позначає як великих власників (вище нуля), або з них (нижче нуля), у USD. Переміщення — не угода; мітка — не особа.", sentence: "чистий рух токенів великих власників" },
    },
  },
  {
    id: "whale_wallet_count",
    family: "cohort-flow",
    unit: "wallets",
    aggregation: "cohort",
    sign: "non-negative",
    windows: BOTH_WINDOWS,
    conditionModes: ["advisory"],
    words: {
      en: { label: "Large-holder addresses active", meaning: "How many addresses the source labels as large holders moved the token in the window. Addresses, not people; one person may hold several.", sentence: "large-holder addresses active" },
      uk: { label: "Активних адрес великих власників", meaning: "Скільки адрес, які джерело позначає як великих власників, рухали токен за вікно. Адреси, не люди; одна людина може мати кілька.", sentence: "активних адрес великих власників" },
    },
  },
];

const BY_ID: ReadonlyMap<EvidenceMetricId, EvidenceMetricDefinition> = new Map(EVIDENCE_METRICS.map((metric) => [metric.id, metric]));

export function evidenceMetric(id: string): EvidenceMetricDefinition | null {
  return BY_ID.get(id as EvidenceMetricId) ?? null;
}

export function isEvidenceMetricId(id: string): id is EvidenceMetricId {
  return BY_ID.has(id as EvidenceMetricId);
}

export function isEvidenceWindow(window: string): window is EvidenceWindow {
  return (EVIDENCE_WINDOWS as readonly string[]).includes(window);
}

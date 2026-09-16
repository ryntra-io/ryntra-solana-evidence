/**
 * The rights map — what each provider family may be used for, written from
 * the provider's own documents and enforced before anything reaches a
 * client, a store or a log.
 *
 * Access to an endpoint is not the right to republish its fields. The map
 * records, per family: whether the redistribution guide allows it (and on
 * what condition), which fields the mapper may read into the snapshot, how
 * long a copy may be held, how long a figure a Review judged may stay with
 * that review, the attribution the terms accept, and where and when the rule
 * was read. A family that is not `allowed` here is not called by the
 * product — not hidden by CSS, not called and dropped, not called.
 *
 * The figures the map allows are aggregates: a volume, a net flow, a count.
 * No family here yields an address, a label or a row to anything outside the
 * mapper, and the mapper reads named fields only, so a new field the
 * provider adds tomorrow is not displayed by accident.
 *
 * The source of each rule is named so the next reader checks the document,
 * not this file. Pure and client-safe: the map is data.
 */

import type { EvidenceAttribution } from "./snapshot.ts";

export type RightsStatus =
  /** Allowed with attribution — the guide's ✅ row. */
  | "allowed-with-attribution"
  /** Approval and significant modification required — not called by the product. */
  | "restricted"
  /** Never redistributed — never called by the product. */
  | "prohibited";

export type FamilyRights = Readonly<{
  /** The provider's family name as the guide lists it (without the `/api/v1/` prefix). */
  family: string;
  /** The live path, which may differ from the guide's name. */
  path: string;
  status: RightsStatus;
  /** The fields the mapper may read; everything else in the answer is dropped unread. */
  fields: readonly string[];
  /** Seconds a copy may sit in Ryntra's cache — never beyond the provider's own documented cache for the family. */
  cacheSeconds: Readonly<Record<"24h" | "7d", number>>;
  /** The provider's documented response cache, seconds, so a card can say how far behind a fresh answer may be. */
  providerLagSeconds: Readonly<Record<"24h" | "7d", number>>;
  /** The provider's credit price per call, as its published credit costs state it on the review date. */
  creditsPerCall: number;
  note: string;
}>;

export type ProviderRights = Readonly<{
  provider: "nansen";
  /** Names the rule set a snapshot was filtered under. */
  policy: string;
  attribution: EvidenceAttribution;
  /** Seconds a figure a Review judged stays readable with that review; after it the value is redacted and Ryntra's verdict stays. */
  retainJudgedValueSeconds: number;
  /** Seconds a snapshot past its expiry may still be served, marked stale, when the provider does not answer; then it is dropped. */
  staleHoldSeconds: number;
  families: readonly FamilyRights[];
  reviewed: Readonly<{ guide: string; guideDate: string; terms: string; termsDate: string; pricing: string; readOn: string }>;
}>;

const DAY = 24 * 3600;

export const NANSEN_RIGHTS: ProviderRights = {
  provider: "nansen",
  policy: "nansen-guide-2025-11-18",
  /* The terms accept "Powered by Nansen" or "Data provided by Nansen"; the
     guide's own wording for the allowed-with-attribution rows is "Powered by
     Nansen API" with a visible link. Both are satisfied by this one line. */
  attribution: { text: "Powered by Nansen API", href: "https://nansen.ai" },
  retainJudgedValueSeconds: 7 * DAY,
  staleHoldSeconds: 30 * 60,
  families: [
    {
      family: "tgm/token-screener",
      path: "/api/v1/token-screener",
      status: "allowed-with-attribution",
      fields: ["token_address", "token_symbol", "volume", "buy_volume", "sell_volume", "netflow"],
      /* A live, point-in-time screener with no provider cache; Ryntra's own
         window coalesces reads of one token so five people opening the same
         asset within five minutes cost one call. */
      cacheSeconds: { "24h": 300, "7d": 900 },
      providerLagSeconds: { "24h": 0, "7d": 0 },
      creditsPerCall: 1,
      note: "Per-token aggregates of DEX activity over a rolling window; the figures cover the whole market as the source counts it.",
    },
    {
      family: "tgm/flow-intelligence",
      path: "/api/v1/tgm/flow-intelligence",
      status: "allowed-with-attribution",
      fields: ["exchange_net_flow_usd", "whale_net_flow_usd", "whale_wallet_count", "warnings"],
      /* The provider caches these answers 10–30 minutes by timeframe; a copy
         held longer than that would be a copy beyond the documented timeframe. */
      cacheSeconds: { "24h": 600, "7d": 1800 },
      providerLagSeconds: { "24h": 600, "7d": 1800 },
      creditsPerCall: 1,
      note: "Net movement and address counts for the source's labelled groups; movement, not trade; exchanges and large holders only — the other groups are not read.",
    },
    {
      family: "tgm/who-bought-sold",
      path: "/api/v1/tgm/who-bought-sold",
      status: "allowed-with-attribution",
      fields: [],
      cacheSeconds: { "24h": 300, "7d": 300 },
      providerLagSeconds: { "24h": 300, "7d": 300 },
      creditsPerCall: 1,
      note: "Allowed by the guide, not read in this slice: its rows are per address and a page is a sample; the whole-market buys and sells come from the screener instead.",
    },
    {
      family: "smart-money/inflows",
      path: "/api/v1/smart-money/netflow",
      status: "restricted",
      fields: [],
      cacheSeconds: { "24h": 0, "7d": 0 },
      providerLagSeconds: { "24h": 0, "7d": 0 },
      creditsPerCall: 5,
      note: "Approval and significant modification required by the guide; the product does not call it.",
    },
    {
      family: "address/labels",
      path: "/api/v1/profiler/address/labels",
      status: "prohibited",
      fields: [],
      cacheSeconds: { "24h": 0, "7d": 0 },
      providerLagSeconds: { "24h": 0, "7d": 0 },
      creditsPerCall: 100,
      note: "Prohibited from redistribution; never called.",
    },
  ],
  reviewed: {
    guide: "https://docs.nansen.ai/guides/redistribution-guide",
    guideDate: "2025-11-18",
    terms: "https://nansen.ai/legal/api",
    termsDate: "2026-06-01",
    pricing: "https://docs.nansen.ai/getting-started/credits",
    readOn: "2026-09-16",
  },
};

export function familyRights(provider: ProviderRights, family: string): FamilyRights | null {
  return provider.families.find((entry) => entry.family === family) ?? null;
}

/** The families the product may call: allowed by the guide and with at least one field the mapper reads. */
export function callableFamilies(provider: ProviderRights): readonly FamilyRights[] {
  return provider.families.filter((entry) => entry.status === "allowed-with-attribution" && entry.fields.length > 0);
}

/**
 * Keep only the fields a family's rights name. Applied to the provider's
 * row before anything else reads it, so the raw answer is gone by the time
 * a mapper, a log or a serializer could see it.
 */
export function filterFields<T extends Record<string, unknown>>(rights: FamilyRights, row: T): Partial<T> {
  const kept: Partial<T> = {};
  for (const field of rights.fields) {
    if (field in row) kept[field as keyof T] = row[field as keyof T];
  }
  return kept;
}

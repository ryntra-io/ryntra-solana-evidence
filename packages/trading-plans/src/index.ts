/**
 * @ryntra/trading-plans — the deterministic helpers of a Trading Plan.
 *
 * A Trading Plan is a set of rules a person writes before they sign: why this
 * asset, how much money, at what entry, where the thesis is wrong. Two parts
 * of it are pure arithmetic and are published here:
 *
 * - **sizing** — the size of a spot-long position from the entry, the
 *   invalidation, the budget and the planned risk, with the assumptions the
 *   figure stands on. The same function sizes the form in the browser and
 *   the stored version on the server, so no client keeps a second financial
 *   logic (`sizing.ts`);
 * - **decimal input** — a number a person typed into a money or price field,
 *   read the way the person meant it: `0,5` is a half, `1 000,50` is
 *   `1000.5`, an empty field is `null` and never zero (`decimal-input.ts`).
 *
 * These are the modules the Ryntra product runs on, imported rather than
 * copied. Nothing here fetches, stores, signs or places an order.
 */

export { computePlanSizing, validatePlanRules, type PlanIssue, type PlanSizing, type PlanSizingRules } from "../../../lib/plans/sizing.ts";

export { decimalReadingDiffers, parseDecimalInput } from "../../../lib/plans/decimal-input.ts";

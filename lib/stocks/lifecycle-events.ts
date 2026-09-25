/**
 * Verified issuer events about pre-IPO tokens — the one place a state the
 * issuer announced (a conversion opened, redemption opened, a window closed)
 * is written down, with the notice, the read time, the issuer's own cut-off
 * and the date it is due for another look.
 *
 * The issuer publishes no such state in an API today (PreStocks
 * `/api/prestocks` lists mints and marks, nothing about a window), so the
 * registry is kept by hand and
 * versioned: an entry is added from the issuer's own notice, never from a
 * pool's quote or a symbol's presence. An empty registry means no event has
 * been verified — it never means every token is fine; the catalogue and the
 * chain still decide `active`, `paused` and `unknown` (`instrument.ts`).
 *
 * `recheckBy` is a promise to look again, not an expiry of the fact: a
 * state past its recheck date is still shown, and named as due for a check.
 * `deadline` is the issuer's own cut-off; a conversion window whose deadline
 * the clock has passed is read as `expired` whatever this file still says.
 */

import type { LifecycleEvent } from "./instrument.ts";

export const LIFECYCLE_EVENTS_VERSION = "2026-09-16.2";

/**
 * Read on 2026-09-16 (08:30–08:55 UTC) from the issuers' own pages.
 *
 * PreStocks — the FAQ: a token converts into the tokenized public stock for
 * up to nine months after an IPO and expires worthless after the conversion
 * deadline; in an acquisition it converts into the acquirer's token by the
 * issuer's ratio, with its own deadline. Two products carry a live notice on
 * their product page:
 *
 * - **SPACEX** (`PreANxu…HsfTh`): *"SpaceX has gone public! SpaceX PreStocks
 *   tokens must be swapped into $SPCXx or any other token before 11:59pm UTC
 *   on 12 March 2027, or they will expire worthless."* SpaceX is listed
 *   (Pyth `Equity.US.SPCX/USD`; xStocks `SPCXx`, Backpack `SPCX`, Ondo
 *   `SPCXon` on the venue). The token still trades and still stands in the
 *   issuer's catalogue: a conversion window, open until the cut-off.
 * - **XAI** (`PreC1Kt…TwfTx`, the venue-verified mint; an `[OUTDATED]`
 *   migration mint `PreYPq1…FCwGS` also exists): *"xAI was acquired by
 *   SpaceX. Each XAI token must be swapped into 0.7165 SPACEX before 11:59pm
 *   UTC on 12 September 2026, or it will expire worthless."* The cut-off has
 *   passed; the token is no longer in the issuer's API. Recorded so that a
 *   purchase of the mint is refused on the Spot routes too, whatever a pool
 *   still quotes.
 *
 * Private companies come through PreStocks only since canon v5.2 (В25–В26);
 * the disconnected issuer's tokens are not events here but retired tokens
 * (`retired.ts`).
 */
export const LIFECYCLE_EVENTS: readonly LifecycleEvent[] = [
  {
    mint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    state: "conversion-open",
    url: "https://www.prestocks.com/spacex",
    observedAt: "2026-09-16T08:40:00.000Z",
    recheckBy: "2026-12-01",
    deadline: "2027-03-12T23:59:00.000Z",
    note: "SpaceX has gone public. The issuer states SPACEX tokens must be swapped into SPCXx or any other token before 23:59 UTC on 12 March 2027, or they expire worthless.",
  },
  {
    mint: "PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx",
    state: "expired",
    url: "https://www.prestocks.com/xai",
    observedAt: "2026-09-16T08:40:00.000Z",
    recheckBy: "2026-12-01",
    deadline: "2026-09-12T23:59:00.000Z",
    note: "xAI was acquired by SpaceX. The issuer's swap window into SPACEX closed at 23:59 UTC on 12 September 2026; the issuer states unswapped tokens expire worthless.",
  },
];

const byMint = new Map(LIFECYCLE_EVENTS.map((event) => [event.mint, event]));

/** The verified event for a mint, or null — the only way the registry is read. */
export function lifecycleEventFor(mint: string, events: ReadonlyMap<string, LifecycleEvent> = byMint): LifecycleEvent | null {
  return events.get(mint) ?? null;
}

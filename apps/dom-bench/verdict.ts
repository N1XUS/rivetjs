// Noise-aware benchmark verdicts (round-2 review B4), shared by scoreboard.ts and apps/ssr-bench/fair-report.ts.
// A strict "<" on one median counted 0.30 vs 0.30 or 78.3 vs 79.0 as a WIN. Now a side only wins when it is
// better by at least MARGIN *and* (when both sides carry trial ranges) the ranges do not overlap; otherwise TIE.

/** Per-number summary of repeated trials. `min`/`max` absent = a stored single value (margin-only verdict). */
export interface Stat {
  median: number;
  min?: number;
  max?: number;
  n?: number;
}
export type Verdict = "WIN" | "TIE" | "LOSE";
export type Better = "lower" | "higher";

/** Minimum relative difference before anything but TIE is reported. */
export const MARGIN = 0.03;

/** Order statistics of trial values (median = mean of the two middle values for even n). */
export function stat(values: number[]): Stat | null {
  const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = s.length;
  if (!n) return null;
  return { median: (s[Math.floor((n - 1) / 2)]! + s[Math.floor(n / 2)]!) / 2, min: s[0]!, max: s[n - 1]!, n };
}

/** Accept a stored number (legacy competitors.json) or a Stat. */
export function asStat(value: number | Stat | null | undefined): Stat | null {
  if (value == null) return null;
  return typeof value === "number" ? { median: value } : value;
}

const hasRange = (s: Stat) => s.min != null && s.max != null;

/**
 * Verdict for `mine` against `theirs`: WIN / LOSE need a ≥ MARGIN median difference and, when both sides have
 * trial ranges, non-overlapping ranges; everything else is a TIE.
 */
export function verdict(mine: Stat, theirs: Stat, better: Better, margin = MARGIN): Verdict {
  if (!(mine.median > 0) || !(theirs.median > 0)) {
    // Zero/negative values (e.g. 0 failures): equal is a tie, otherwise plain ordering.
    if (mine.median === theirs.median) return "TIE";
    return (better === "lower" ? mine.median < theirs.median : mine.median > theirs.median) ? "WIN" : "LOSE";
  }
  // advantage > 1: mine is better by that factor.
  const advantage = better === "lower" ? theirs.median / mine.median : mine.median / theirs.median;
  const ranged = hasRange(mine) && hasRange(theirs);
  const mineAhead = better === "lower" ? mine.max! < theirs.min! : mine.min! > theirs.max!;
  const theirsAhead = better === "lower" ? theirs.max! < mine.min! : theirs.min! > mine.max!;
  if (advantage >= 1 + margin && (!ranged || mineAhead)) return "WIN";
  if (advantage <= 1 / (1 + margin) && (!ranged || theirsAhead)) return "LOSE";
  return "TIE";
}

/** Combine per-competitor verdicts: any LOSE → LOSE, all WIN → WIN, otherwise TIE. */
export function overall(verdicts: Verdict[]): Verdict | "n/a" {
  if (!verdicts.length) return "n/a";
  if (verdicts.includes("LOSE")) return "LOSE";
  return verdicts.every((v) => v === "WIN") ? "WIN" : "TIE";
}

/** Browser build drift between the stored reference and this run: same / patch (same major.minor.build) / major. */
export function browserDrift(reference: string | undefined, actual: string | undefined): "same" | "patch" | "major" | "unknown" {
  if (!reference || !actual) return "unknown";
  if (reference === actual) return "same";
  const [a, b] = [reference, actual].map((v) => v.split(".").slice(0, 1).join("."));
  return a === b ? "patch" : "major";
}

/** Chrome build of `krausest/published.json` (recorded under `source.chrome`; a top-level `chrome` is accepted too). */
export function publishedChrome(published: { chrome?: string; source?: { chrome?: string } }): string | undefined {
  return published.source?.chrome ?? published.chrome;
}

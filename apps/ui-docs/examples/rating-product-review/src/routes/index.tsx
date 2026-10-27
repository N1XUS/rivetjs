// Rivet-authored Rating demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Rating } from "@rivetjs/ui/rating";

export const head = { title: "Rating: product review" };

// #region demo
const COUNTS = [
  { stars: 5, count: 412 },
  { stars: 4, count: 158 },
  { stars: 3, count: 61 },
  { stars: 2, count: 19 },
  { stars: 1, count: 12 },
];
const TOTAL = COUNTS.reduce((sum, row) => sum + row.count, 0);
const AVERAGE = COUNTS.reduce((sum, row) => sum + row.stars * row.count, 0) / TOTAL;

export function ProductReview() {
  return (
    <section id="rt-review" class="flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-surface p-5 shadow-surface">
      <div class="flex items-center gap-3">
        <span class="text-4xl font-semibold tabular-nums">{AVERAGE.toFixed(1)}</span>
        <div class="flex flex-col gap-1">
          <Rating isReadOnly value={AVERAGE} />
          <span class="text-xs text-muted">{TOTAL} reviews</span>
        </div>
      </div>
      <ul class="flex flex-col gap-1.5">
        {COUNTS.map((row) => (
          <li class="flex items-center gap-2 text-xs">
            <span class="w-3 tabular-nums">{row.stars}</span>
            <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-default">
              <span class="block h-full rounded-full bg-warning" style={{ width: `${Math.round((row.count / TOTAL) * 100)}%` }} />
            </span>
            <span class="w-8 text-end text-muted tabular-nums">{row.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <ProductReview />
    </div>
  );
}

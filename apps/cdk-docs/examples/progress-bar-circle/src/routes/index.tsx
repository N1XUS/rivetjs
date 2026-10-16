import { ProgressBar } from "@rivetjs/cdk/progress-bar";

export const head = { title: "ProgressCircle" };

const R = 14;
const C = 2 * Math.PI * R;

// #region demo
export default function Circles() {
  return (
    <div class="m-4 flex items-center gap-4 text-sm">
      <ProgressBar id="circle" value={30} aria-label="Loading…">
        {({ percentage }) => (
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none" stroke-width="4">
            <circle cx="16" cy="16" r={R} stroke="#e2e8f0" />
            <circle
              id="circle-arc"
              cx="16"
              cy="16"
              r={R}
              stroke="#4f46e5"
              stroke-dasharray={`${C} ${C}`}
              stroke-dashoffset={String(C - ((percentage() ?? 0) / 100) * C)}
              stroke-linecap="round"
              transform="rotate(-90 16 16)"
            />
          </svg>
        )}
      </ProgressBar>
      <ProgressBar id="spinner" isIndeterminate aria-label="Saving…">
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none" stroke-width="4" class="animate-spin">
          <circle cx="16" cy="16" r={R} stroke="#e2e8f0" />
          <circle cx="16" cy="16" r={R} stroke="#4f46e5" stroke-dasharray={`${C / 4} ${C}`} stroke-linecap="round" />
        </svg>
      </ProgressBar>
    </div>
  );
}
// #endregion

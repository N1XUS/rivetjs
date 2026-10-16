import { signal } from "@rivetjs/reactivity";
import { ProgressBar } from "@rivetjs/cdk/progress-bar";
import { Label } from "@rivetjs/cdk/label";
import { Switch } from "@rivetjs/cdk/switch";

export const head = { title: "Indeterminate ProgressBar" };

// #region demo
export default function Busy() {
  const unknown = signal(true);
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <ProgressBar
        id="sync"
        value={60}
        isIndeterminate={() => unknown()}
        class={({ isIndeterminate }) => (isIndeterminate() ? "grid gap-1 busy" : "grid gap-1")}
      >
        {({ percentage, valueText, isIndeterminate }) => (
          <>
            <Label>Syncing</Label>
            <span id="sync-text">{isIndeterminate() ? "Working…" : valueText()}</span>
            <div class="relative h-2 overflow-hidden rounded bg-slate-200">
              <div
                class={isIndeterminate() ? "absolute h-full w-1/3 animate-pulse bg-amber-500" : "h-full bg-amber-500"}
                style={{ width: percentage() === undefined ? undefined : percentage() + "%" }}
              />
            </div>
          </>
        )}
      </ProgressBar>
      <Switch id="known" isSelected={signal(false)} onChange={(on) => unknown.set(!on)}>
        Progress known
      </Switch>
    </div>
  );
}
// #endregion

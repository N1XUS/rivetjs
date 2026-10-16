import { signal } from "@rivetjs/reactivity";
import { ProgressBar } from "@rivetjs/cdk/progress-bar";
import { Label } from "@rivetjs/cdk/label";
import { Button } from "@rivetjs/cdk/button";

export const head = { title: "ProgressBar driven by a signal" };

// #region demo
export default function Upload() {
  const done = signal(20);
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <ProgressBar id="upload" value={() => done()} class="grid grid-cols-[1fr_auto] gap-1">
        {({ percentage, valueText }) => (
          <>
            <Label>Uploading photos…</Label>
            <span id="upload-text">{valueText()}</span>
            <div class="col-span-2 h-2 overflow-hidden rounded bg-slate-200">
              <div id="upload-fill" class="h-full bg-sky-600 transition-[width]" style={{ width: percentage() + "%" }} />
            </div>
          </>
        )}
      </ProgressBar>
      <div class="flex gap-2">
        <Button id="step" class="rounded border px-2 py-1" onPress={() => done.set(Math.min(100, done() + 20))}>
          +20%
        </Button>
        <Button id="reset" class="rounded border px-2 py-1" onPress={() => done.set(0)}>
          Reset
        </Button>
      </div>
    </div>
  );
}
// #endregion

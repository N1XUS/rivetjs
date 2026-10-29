// Rivet-authored Morph demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Morph } from "@rivetjs/ui/morph";

export const head = { title: "Morph: Controlled" };

// #region demo
export function Controlled() {
  const open = signal(false);
  return (
    <div class="flex flex-col items-center gap-6">
      <Morph id="morph-controlled" isOpen={open} variant="secondary">
        <Morph.CollapsedContent>
          <span class="text-sm">Delivery: Thursday</span>
          <Morph.Trigger>Change</Morph.Trigger>
        </Morph.CollapsedContent>
        <Morph.ExpandedContent aria-label="Delivery options" class="w-64">
          <h2 class="text-sm font-semibold">Delivery options</h2>
          <p class="text-sm text-muted">Standard, Thursday: free. Express, tomorrow: $9.</p>
          <Morph.Close id="morph-controlled-close" size="sm">
            Keep Thursday
          </Morph.Close>
        </Morph.ExpandedContent>
      </Morph>
      <div class="flex items-center gap-3 text-sm">
        <Button id="morph-controlled-toggle" size="sm" variant="secondary" onPress={() => open.set(!open())}>
          Toggle from outside
        </Button>
        <span>
          State: <span id="morph-controlled-state">{open() ? "open" : "closed"}</span>
        </span>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-end justify-center p-6 pb-10">
      <Controlled />
    </div>
  );
}

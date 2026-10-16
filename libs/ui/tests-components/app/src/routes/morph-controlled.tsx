// Controlled Morph on a resumed page: `#ctl` follows a two-way Signal toggled by the native `#ctl-toggle` (state `#ctl-state`);
// its follower `clientEffect` boots (kept off `/morph`, whose uncontrolled morphs run nothing at load).
import { signal } from "@rivetjs/reactivity";
import { Morph } from "@rivetjs/ui/morph";

export default function MorphControlledStory() {
  const open = signal(false);
  return (
    <main class="flex min-h-[90vh] flex-col items-center justify-end gap-10 p-6">
      <div class="flex items-center gap-4">
        <button id="ctl-toggle" type="button" onClick={() => open.set(!open())}>
          toggle controlled
        </button>
        <span id="ctl-state">{open() ? "open" : "closed"}</span>
      </div>
      <Morph id="ctl" isOpen={open} variant="secondary">
        <Morph.CollapsedContent>
          Controlled
          <Morph.Trigger>Open</Morph.Trigger>
        </Morph.CollapsedContent>
        <Morph.ExpandedContent aria-label="Controlled panel" class="w-64">
          <p>Controlled panel</p>
          <Morph.Close size="sm">Done</Morph.Close>
        </Morph.ExpandedContent>
      </Morph>
    </main>
  );
}

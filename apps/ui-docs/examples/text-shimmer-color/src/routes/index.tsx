// Rivet-authored TextShimmer demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { TextShimmer } from "@rivetjs/ui/text-shimmer";

export const head = { title: "TextShimmer: Color" };

// #region demo
export function Colors() {
  const active = signal(true);
  return (
    <div class="flex flex-col items-start gap-3">
      <TextShimmer class="text-sm text-muted">Searching the web…</TextShimmer>
      <TextShimmer class="text-base font-medium text-accent">Drafting a plan</TextShimmer>
      <TextShimmer class="text-lg font-semibold text-success" isActive={() => active()}>
        Running tests
      </TextShimmer>
      <Button id="shimmer-toggle" size="sm" variant="secondary" onPress={() => active.set(!active())}>
        {active() ? "Pause" : "Resume"}
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Colors />
    </div>
  );
}

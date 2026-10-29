// Rivet-authored Morph demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Morph } from "@rivetjs/ui/morph";
import type { MorphAnimation } from "@rivetjs/ui/morph";

export const head = { title: "Morph: Animation" };

// #region demo
const CASES: { id: string; label: string; animation: MorphAnimation }[] = [
  { id: "morph-anim-default", label: "Default", animation: true },
  { id: "morph-anim-slow", label: "Slow, no bounce", animation: { duration: 30, friction: 0.75 } },
  { id: "morph-anim-off", label: "Disabled", animation: "disabled" },
];

export function Animation() {
  return (
    <div class="flex flex-wrap items-end justify-center gap-6">
      {CASES.map((c) => (
        <Morph id={c.id} animation={c.animation} variant="secondary">
          <Morph.CollapsedContent>
            <span class="text-sm">{c.label}</span>
            <Morph.Trigger id={`${c.id}-view`}>Open</Morph.Trigger>
          </Morph.CollapsedContent>
          <Morph.ExpandedContent aria-label={c.label} class="w-56">
            <p class="text-sm">{c.label} motion.</p>
            <Morph.Close size="sm" variant="secondary">
              Close
            </Morph.Close>
          </Morph.ExpandedContent>
        </Morph>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-end justify-center p-6 pb-10">
      <Animation />
    </div>
  );
}

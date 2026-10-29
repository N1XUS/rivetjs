// Rivet-authored Morph demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Morph } from "@rivetjs/ui/morph";
import type { MorphDirection } from "@rivetjs/ui/morph";

export const head = { title: "Morph: Directions" };

// #region demo
const DIRECTIONS: MorphDirection[] = ["top-start", "top", "top-end", "start", "end", "bottom-start", "bottom", "bottom-end"];

export function Directions() {
  return (
    <div class="grid grid-cols-2 gap-x-6 gap-y-24 sm:grid-cols-4">
      {DIRECTIONS.map((direction) => (
        <div class="flex justify-center">
          <Morph id={`morph-dir-${direction}`} direction={direction} variant="secondary">
            <Morph.CollapsedContent>
              <span class="text-sm">{direction}</span>
              <Morph.Trigger id={`morph-dir-${direction}-view`}>Open</Morph.Trigger>
            </Morph.CollapsedContent>
            <Morph.ExpandedContent aria-label={`Grows ${direction}`} class="w-56">
              <p class="text-sm">Grows toward {direction}. Press outside or Escape to close.</p>
              <Morph.Close size="sm" variant="secondary">
                Close
              </Morph.Close>
            </Morph.ExpandedContent>
          </Morph>
        </div>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Directions />
    </div>
  );
}

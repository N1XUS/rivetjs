// Rivet-authored Morph demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Morph } from "@rivetjs/ui/morph";
import { Bell } from "lucide";

export const head = { title: "Morph: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex flex-wrap items-end justify-center gap-6">
      {(["primary", "secondary"] as const).map((variant) => (
        <Morph id={`morph-variant-${variant}`} variant={variant}>
          <Morph.CollapsedContent>
            <Icon icon={Bell} size={16} />
            <span class="text-sm">3 new</span>
            <Morph.Trigger id={`morph-variant-${variant}-view`}>Show</Morph.Trigger>
          </Morph.CollapsedContent>
          <Morph.ExpandedContent aria-label="Notifications" class="w-64">
            <h2 class="text-sm font-semibold">Notifications</h2>
            <p class="text-sm text-muted">Mara shared "Spring lookbook".</p>
            <p class="text-sm text-muted">Your return was received.</p>
            <p class="text-sm text-muted">Order 4821 has shipped.</p>
            <Morph.Close size="sm" variant="tertiary">
              Done
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
      <Variants />
    </div>
  );
}

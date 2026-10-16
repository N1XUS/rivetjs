// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toggle-button/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Heart } from "lucide";
import { ToggleButton } from "@rivetjs/ui/toggle-button";

export const head = { title: "ToggleButton: Controlled" };

// #region demo
// Rivet: `isSelected` takes a signal (two-way), in place of React's `isSelected` + `onChange` pair.
export function Controlled() {
  const isSelected = signal(false);

  return (
    <div class="flex flex-col gap-4">
      <ToggleButton isSelected={isSelected}>
        {({ isSelected: selected }) => (
          <>
            {selected() ? <Icon icon={Heart} size={16} fill="currentColor" /> : <Icon icon={Heart} size={16} />}
            {selected() ? "Liked" : "Like"}
          </>
        )}
      </ToggleButton>
      <p class="text-sm text-muted">
        Status: <span class="font-medium">{isSelected() ? "Selected" : "Not selected"}</span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}

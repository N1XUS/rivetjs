import { signal } from "@rivetjs/reactivity";
import { Switch } from "@rivetjs/ui/switch";

/** Pass the signal itself for two-way state, and read it for live text. */
export function ReadingPreferences() {
  const showTips = signal(true);
  return (
    <section class="flex flex-col gap-3" aria-labelledby="reading-preferences">
      <h2 id="reading-preferences" class="text-lg font-semibold">
        Reading preferences
      </h2>
      <Switch isSelected={showTips} label="Show learning tips" />
      <p class="text-muted">
        {showTips() ? "Tip: pass a signal to a component's two-way prop to keep its state in sync." : "Learning tips are hidden for this visit."}
      </p>
    </section>
  );
}

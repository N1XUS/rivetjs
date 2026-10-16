// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/close-button/interactive.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { CloseButton } from "@rivetjs/ui/close-button";

export const head = { title: "CloseButton: Interactive" };

// #region demo
export function Interactive() {
  const count = signal(0);

  return (
    <div class="flex flex-col items-center justify-center gap-4">
      <CloseButton aria-label={`Close (clicked ${count()} times)`} onPress={() => count.set(count() + 1)} />
      <span class="text-sm text-muted">Clicked: {count()} times</span>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Interactive />
    </div>
  );
}

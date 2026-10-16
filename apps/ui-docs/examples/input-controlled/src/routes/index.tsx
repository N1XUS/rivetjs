// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Input } from "@rivetjs/ui/input";

export const head = { title: "Input: Controlled" };

// #region demo
export function Controlled() {
  const value = signal("rivetjs.dev");

  return (
    <div class="flex w-80 flex-col gap-2">
      <Input aria-label="Domain" placeholder="domain" value={value()} onInput={(event) => value.set((event.target as HTMLInputElement).value)} />
      <span class="px-1 text-sm text-muted">https://{value() || "your-domain"}</span>
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

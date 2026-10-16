// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/kbd/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Kbd } from "@rivetjs/ui/kbd";

export const head = { title: "Kbd: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <div class="flex items-center gap-3">
      <Kbd class="rounded-lg bg-accent-soft px-2.5 text-accent-soft-foreground">
        <Kbd.Abbr keyValue="command" />
        <Kbd.Content>K</Kbd.Content>
      </Kbd>
      <Kbd class="rounded-lg bg-default px-2.5 text-muted">
        <Kbd.Abbr keyValue="shift" />
        <Kbd.Content>P</Kbd.Content>
      </Kbd>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}

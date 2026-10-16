// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/separator/with-surface.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Separator } from "@rivetjs/ui/separator";
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "Separator: With Surface" };

// #region demo
export function WithSurface() {
  return (
    <div class="flex flex-col gap-8">
      <div class="flex flex-col gap-2">
        <Surface class="flex min-w-[320px] flex-col gap-3 rounded-3xl p-6" variant="default">
          <h3 class="text-base font-semibold text-foreground">Default Surface</h3>
          <Separator />
          <p class="text-sm text-muted">Surface Content</p>
        </Surface>
      </div>

      <div class="flex flex-col gap-2">
        <Surface class="flex min-w-[320px] flex-col gap-3 rounded-3xl p-6" variant="secondary">
          <h3 class="text-base font-semibold text-foreground">Secondary Surface</h3>
          <Separator variant="secondary" />
          <p class="text-sm text-muted">Surface Content</p>
        </Surface>
      </div>

      <div class="flex flex-col gap-2">
        <Surface class="flex min-w-[320px] flex-col gap-3 rounded-3xl p-6" variant="tertiary">
          <h3 class="text-base font-semibold text-foreground">Tertiary Surface</h3>
          <Separator variant="tertiary" />
          <p class="text-sm text-muted">Surface Content</p>
        </Surface>
      </div>

      <div class="flex flex-col gap-2">
        <Surface class="flex min-w-[320px] flex-col gap-3 rounded-3xl border p-6" variant="transparent">
          <h3 class="text-base font-semibold text-foreground">Transparent Surface</h3>
          <Separator />
          <p class="text-sm text-muted">Surface Content</p>
        </Surface>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithSurface />
    </div>
  );
}

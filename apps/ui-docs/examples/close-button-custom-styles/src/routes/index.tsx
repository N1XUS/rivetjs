// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/close-button/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { CloseButton } from "@rivetjs/ui/close-button";

export const head = { title: "CloseButton: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return <CloseButton aria-label="Close" class="size-8 rounded-full bg-default text-muted hover:bg-default-hover hover:text-foreground active:scale-95" />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}

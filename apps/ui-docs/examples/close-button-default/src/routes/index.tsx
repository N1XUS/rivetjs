// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/close-button/default.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { CloseButton } from "@rivetjs/ui/close-button";

export const head = { title: "CloseButton: Usage" };

// #region demo
export function Default() {
  return <CloseButton />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Default />
    </div>
  );
}

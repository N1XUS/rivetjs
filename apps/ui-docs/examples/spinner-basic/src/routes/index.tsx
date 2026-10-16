// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/spinner/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "Spinner: Usage" };

// #region demo
export function SpinnerBasic() {
  return (
    <div class="flex items-center gap-4">
      <Spinner />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <SpinnerBasic />
    </div>
  );
}

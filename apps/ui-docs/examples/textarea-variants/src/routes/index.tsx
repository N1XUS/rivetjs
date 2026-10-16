// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textarea/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { TextArea } from "@rivetjs/ui/textarea";

export const head = { title: "TextArea: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex w-[280px] flex-col gap-2">
      <TextArea fullWidth placeholder="Primary textarea" variant="primary" />
      <TextArea fullWidth placeholder="Secondary textarea" variant="secondary" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}

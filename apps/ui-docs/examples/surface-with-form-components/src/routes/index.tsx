// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/surface/with-form-components.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Input } from "@rivetjs/ui/input";
import { Surface } from "@rivetjs/ui/surface";
import { TextArea } from "@rivetjs/ui/textarea";

export const head = { title: "Surface: With Form Components" };

// #region demo
export function WithFormComponents() {
  return (
    <Surface class="flex min-w-[320px] flex-col gap-4 rounded-3xl p-6" variant="default">
      <Input placeholder="Input with secondary variant" variant="secondary" />
      <TextArea placeholder="TextArea with secondary variant" variant="secondary" />
    </Surface>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithFormComponents />
    </div>
  );
}

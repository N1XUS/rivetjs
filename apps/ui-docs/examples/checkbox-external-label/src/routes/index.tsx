// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/external-label.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "Checkbox: External Label" };

// #region demo
export function ExternalLabel() {
  return (
    <div class="flex items-center gap-3">
      <Checkbox id="label-marketing">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox.Content>
      </Checkbox>
      <Label for="label-marketing">Send me marketing emails</Label>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ExternalLabel />
    </div>
  );
}

// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox-group/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { CheckboxGroup } from "@rivetjs/ui/checkbox-group";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "CheckboxGroup: Controlled" };

// #region demo
export function Controlled() {
  const selected = signal<string[]>(["coding", "design"]);

  return (
    <CheckboxGroup class="min-w-[320px]" name="skills" value={selected}>
      <Label>Your skills</Label>
      <Checkbox value="coding">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Coding
        </Checkbox.Content>
      </Checkbox>
      <Checkbox value="design">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Design
        </Checkbox.Content>
      </Checkbox>
      <Checkbox value="writing">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Writing
        </Checkbox.Content>
      </Checkbox>
      <Label class="my-4 text-sm text-muted">Selected: {selected().join(", ") || "None"}</Label>
    </CheckboxGroup>
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

// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox-group/indeterminate.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { CheckboxGroup } from "@rivetjs/ui/checkbox-group";

export const head = { title: "CheckboxGroup: Indeterminate" };

// #region demo
export function Indeterminate() {
  const selected = signal<string[]>(["coding"]);
  const allOptions = ["coding", "design", "writing"];

  return (
    <div>
      <Checkbox
        isIndeterminate={selected().length > 0 && selected().length < allOptions.length}
        isSelected={selected().length === allOptions.length}
        name="select-all"
        onChange={(isSelected: boolean) => {
          selected.set(isSelected ? allOptions : []);
        }}
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Select all
        </Checkbox.Content>
      </Checkbox>
      <div class="ms-6 flex flex-col gap-2">
        <CheckboxGroup value={selected}>
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
        </CheckboxGroup>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Indeterminate />
    </div>
  );
}

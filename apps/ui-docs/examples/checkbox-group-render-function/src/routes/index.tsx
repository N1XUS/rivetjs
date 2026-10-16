// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox-group/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";
import { CheckboxGroup } from "@rivetjs/ui/checkbox-group";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "CheckboxGroup: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <CheckboxGroup name="interests" render={(props) => <div {...props} data-custom="foo" />}>
      <Label>Select your interests</Label>
      <Description>Choose all that apply</Description>
      <Checkbox value="coding">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Coding
        </Checkbox.Content>
        <Description>Love building software</Description>
      </Checkbox>
      <Checkbox value="design">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Design
        </Checkbox.Content>
        <Description>Enjoy creating beautiful interfaces</Description>
      </Checkbox>
      <Checkbox value="writing">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Writing
        </Checkbox.Content>
        <Description>Passionate about content creation</Description>
      </Checkbox>
    </CheckboxGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderFunction />
    </div>
  );
}

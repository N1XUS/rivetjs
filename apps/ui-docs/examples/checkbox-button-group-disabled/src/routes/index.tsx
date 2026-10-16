// Rivet-authored CheckboxButtonGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";

export const head = { title: "CheckboxButtonGroup: Disabled Group" };

// #region demo
export function Disabled() {
  return (
    <div class="flex w-[30rem] flex-col gap-6">
      <CheckboxButtonGroup defaultValue={["eu"]} isDisabled>
        <Label>Region (locked)</Label>
        <CheckboxButtonGroup.Item value="eu">
          <CheckboxButtonGroup.Indicator />
          <CheckboxButtonGroup.ItemContent>
            <Label>Europe</Label>
            <Description>Frankfurt</Description>
          </CheckboxButtonGroup.ItemContent>
        </CheckboxButtonGroup.Item>
        <CheckboxButtonGroup.Item value="us">
          <CheckboxButtonGroup.Indicator />
          <CheckboxButtonGroup.ItemContent>
            <Label>United States</Label>
            <Description>Virginia</Description>
          </CheckboxButtonGroup.ItemContent>
        </CheckboxButtonGroup.Item>
      </CheckboxButtonGroup>
      <CheckboxButtonGroup defaultValue={["eu"]}>
        <Label>Region</Label>
        <CheckboxButtonGroup.Item value="eu">
          <CheckboxButtonGroup.Indicator />
          <CheckboxButtonGroup.ItemContent>
            <Label>Europe</Label>
            <Description>Frankfurt</Description>
          </CheckboxButtonGroup.ItemContent>
        </CheckboxButtonGroup.Item>
        <CheckboxButtonGroup.Item value="us">
          <CheckboxButtonGroup.Indicator />
          <CheckboxButtonGroup.ItemContent>
            <Label>United States</Label>
            <Description>Virginia</Description>
          </CheckboxButtonGroup.ItemContent>
        </CheckboxButtonGroup.Item>
        <CheckboxButtonGroup.Item value="ap" isDisabled>
          <CheckboxButtonGroup.Indicator />
          <CheckboxButtonGroup.ItemContent>
            <Label>Asia Pacific</Label>
            <Description>Coming soon</Description>
          </CheckboxButtonGroup.ItemContent>
        </CheckboxButtonGroup.Item>
      </CheckboxButtonGroup>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}

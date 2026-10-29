// Rivet-authored RadioButtonGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export const head = { title: "RadioButtonGroup: Disabled Group" };

// #region demo
export function Disabled() {
  return (
    <div class="flex w-[30rem] flex-col gap-6">
      <RadioButtonGroup defaultValue="eu" isDisabled>
        <Label>Region (locked)</Label>
        <RadioButtonGroup.Item value="eu">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemContent>
            <Label>Europe</Label>
            <Description>Frankfurt</Description>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
        <RadioButtonGroup.Item value="us">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemContent>
            <Label>United States</Label>
            <Description>Virginia</Description>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
      </RadioButtonGroup>
      <RadioButtonGroup defaultValue="eu">
        <Label>Region</Label>
        <RadioButtonGroup.Item value="eu">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemContent>
            <Label>Europe</Label>
            <Description>Frankfurt</Description>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
        <RadioButtonGroup.Item value="us">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemContent>
            <Label>United States</Label>
            <Description>Virginia</Description>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
        <RadioButtonGroup.Item value="ap" isDisabled>
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemContent>
            <Label>Asia Pacific</Label>
            <Description>Coming soon</Description>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
      </RadioButtonGroup>
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

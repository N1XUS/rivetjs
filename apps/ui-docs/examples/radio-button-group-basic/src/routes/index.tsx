// Rivet-authored RadioButtonGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export const head = { title: "RadioButtonGroup: Usage" };

// #region demo
export function Basic() {
  return (
    <RadioButtonGroup class="w-[34rem]" defaultValue="medium">
      <Label>Workspace size</Label>
      <RadioButtonGroup.Item value="small">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemContent>
          <Label>Small</Label>
          <Description>Up to 5 people</Description>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="medium">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemContent>
          <Label>Medium</Label>
          <Description>Up to 25 people</Description>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="large">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemContent>
          <Label>Large</Label>
          <Description>Unlimited</Description>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
    </RadioButtonGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}

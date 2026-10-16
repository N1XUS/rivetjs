// Rivet-authored RadioButtonGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Heart, Star } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export const head = { title: "RadioButtonGroup: Custom Indicator" };

// #region demo
export function CustomIndicator() {
  return (
    <RadioButtonGroup class="w-[30rem]" defaultValue="mountains">
      <Label>Trip style</Label>
      <RadioButtonGroup.Item value="mountains">
        <RadioButtonGroup.Indicator>{({ isSelected }) => <Icon icon={isSelected() ? Heart : Star} class="size-4" />}</RadioButtonGroup.Indicator>
        <RadioButtonGroup.ItemContent>
          <Label>Mountains</Label>
          <Description>Trails and huts</Description>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="coast">
        <RadioButtonGroup.Indicator>{({ isSelected }) => <Icon icon={isSelected() ? Heart : Star} class="size-4" />}</RadioButtonGroup.Indicator>
        <RadioButtonGroup.ItemContent>
          <Label>Coast</Label>
          <Description>Beaches and cliffs</Description>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
    </RadioButtonGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomIndicator />
    </div>
  );
}

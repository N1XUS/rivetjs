// Rivet-authored CheckboxButtonGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Heart, Star } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";

export const head = { title: "CheckboxButtonGroup: Custom Indicator" };

// #region demo
export function CustomIndicator() {
  return (
    <CheckboxButtonGroup class="w-[30rem]" defaultValue={["mountains"]}>
      <Label>Trip style</Label>
      <CheckboxButtonGroup.Item value="mountains">
        <CheckboxButtonGroup.Indicator>{({ isSelected }) => <Icon icon={isSelected() ? Heart : Star} class="size-4" />}</CheckboxButtonGroup.Indicator>
        <CheckboxButtonGroup.ItemContent>
          <Label>Mountains</Label>
          <Description>Trails and huts</Description>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="coast">
        <CheckboxButtonGroup.Indicator>{({ isSelected }) => <Icon icon={isSelected() ? Heart : Star} class="size-4" />}</CheckboxButtonGroup.Indicator>
        <CheckboxButtonGroup.ItemContent>
          <Label>Coast</Label>
          <Description>Beaches and cliffs</Description>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
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

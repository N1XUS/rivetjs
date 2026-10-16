// Rivet-authored RadioButtonGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Camera, Laptop, Music, Smartphone } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export const head = { title: "RadioButtonGroup: Grid Layout" };

// #region demo
export function GridLayout() {
  return (
    <RadioButtonGroup class="w-[28rem]" defaultValue="laptop" layout="grid">
      <Label>Primary device</Label>
      <RadioButtonGroup.Item value="phone">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>
          <Icon icon={Smartphone} />
        </RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Phone</Label>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="laptop">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>
          <Icon icon={Laptop} />
        </RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Laptop</Label>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="camera">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>
          <Icon icon={Camera} />
        </RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Camera</Label>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="speaker">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>
          <Icon icon={Music} />
        </RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Speaker</Label>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
    </RadioButtonGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <GridLayout />
    </div>
  );
}

// Rivet-authored RadioButtonGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Moon, Palette, Sun } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export const head = { title: "RadioButtonGroup: Icon Cards" };

// #region demo
export function IconCards() {
  return (
    <RadioButtonGroup class="w-[26rem] grid-cols-3" defaultValue="light" layout="grid">
      <Label>Theme</Label>
      <RadioButtonGroup.Item value="light" class="flex-col items-center gap-2 px-3 py-5 text-center">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>
          <Icon icon={Sun} />
        </RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Light</Label>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="dark" class="flex-col items-center gap-2 px-3 py-5 text-center">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>
          <Icon icon={Moon} />
        </RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Dark</Label>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="custom" class="flex-col items-center gap-2 px-3 py-5 text-center">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>
          <Icon icon={Palette} />
        </RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Custom</Label>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
    </RadioButtonGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <IconCards />
    </div>
  );
}

// Rivet-authored CheckboxButtonGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Moon, Palette, Sun } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";

export const head = { title: "CheckboxButtonGroup: Icon Cards" };

// #region demo
export function IconCards() {
  return (
    <CheckboxButtonGroup class="w-[26rem] grid-cols-3" defaultValue={["light"]} layout="grid">
      <Label>Themes</Label>
      <CheckboxButtonGroup.Item value="light" class="flex-col items-center gap-2 px-3 py-5 text-center">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>
          <Icon icon={Sun} />
        </CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Light</Label>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="dark" class="flex-col items-center gap-2 px-3 py-5 text-center">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>
          <Icon icon={Moon} />
        </CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Dark</Label>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="custom" class="flex-col items-center gap-2 px-3 py-5 text-center">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>
          <Icon icon={Palette} />
        </CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Custom</Label>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
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

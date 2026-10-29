// Rivet-authored CheckboxButtonGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Camera, Laptop, Music, Smartphone } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";

export const head = { title: "CheckboxButtonGroup: Grid Layout" };

// #region demo
export function GridLayout() {
  return (
    <CheckboxButtonGroup class="w-[28rem]" defaultValue={["laptop"]} layout="grid">
      <Label>Devices</Label>
      <CheckboxButtonGroup.Item value="phone">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>
          <Icon icon={Smartphone} />
        </CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Phone</Label>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="laptop">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>
          <Icon icon={Laptop} />
        </CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Laptop</Label>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="camera">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>
          <Icon icon={Camera} />
        </CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Camera</Label>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="speaker">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>
          <Icon icon={Music} />
        </CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Speaker</Label>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
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

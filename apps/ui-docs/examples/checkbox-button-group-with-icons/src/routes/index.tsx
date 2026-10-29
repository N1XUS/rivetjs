// Rivet-authored CheckboxButtonGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Cloud, Globe, HardDrive } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";

export const head = { title: "CheckboxButtonGroup: With Icons" };

// #region demo
export function WithIcons() {
  return (
    <CheckboxButtonGroup class="w-[30rem] flex-col" defaultValue={["cloud"]}>
      <Label>Sync targets</Label>
      <CheckboxButtonGroup.Item value="cloud">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>
          <Icon icon={Cloud} />
        </CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Cloud</Label>
          <Description>Encrypted, managed for you</Description>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="local">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>
          <Icon icon={HardDrive} />
        </CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Local disk</Label>
          <Description>Stays on this machine</Description>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="cdn">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>
          <Icon icon={Globe} />
        </CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Edge cache</Label>
          <Description>Served close to users</Description>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithIcons />
    </div>
  );
}

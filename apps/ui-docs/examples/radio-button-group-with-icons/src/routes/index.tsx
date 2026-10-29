// Rivet-authored RadioButtonGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Cloud, Globe, HardDrive } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export const head = { title: "RadioButtonGroup: With Icons" };

// #region demo
export function WithIcons() {
  return (
    <RadioButtonGroup class="w-[30rem] flex-col" defaultValue="cloud">
      <Label>Storage</Label>
      <RadioButtonGroup.Item value="cloud">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>
          <Icon icon={Cloud} />
        </RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Cloud</Label>
          <Description>Encrypted, managed for you</Description>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="local">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>
          <Icon icon={HardDrive} />
        </RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Local disk</Label>
          <Description>Stays on this machine</Description>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="cdn">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>
          <Icon icon={Globe} />
        </RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Edge cache</Label>
          <Description>Served close to users</Description>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
    </RadioButtonGroup>
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

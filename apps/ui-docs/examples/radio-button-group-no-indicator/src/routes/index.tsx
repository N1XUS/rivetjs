// Rivet-authored RadioButtonGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export const head = { title: "RadioButtonGroup: No Indicator" };

// #region demo
export function NoIndicator() {
  return (
    <RadioButtonGroup class="w-[34rem]" defaultValue="en">
      <Label>Language</Label>
      <RadioButtonGroup.Item value="en">
        <RadioButtonGroup.ItemContent>
          <Label>English</Label>
          <Description>Default</Description>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="es">
        <RadioButtonGroup.ItemContent>
          <Label>Spanish</Label>
          <Description>Beta</Description>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="de">
        <RadioButtonGroup.ItemContent>
          <Label>German</Label>
          <Description>Beta</Description>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
    </RadioButtonGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <NoIndicator />
    </div>
  );
}

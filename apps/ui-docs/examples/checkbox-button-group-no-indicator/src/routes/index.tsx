// Rivet-authored CheckboxButtonGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";

export const head = { title: "CheckboxButtonGroup: No Indicator" };

// #region demo
export function NoIndicator() {
  return (
    <CheckboxButtonGroup class="w-[34rem]" defaultValue={["en"]}>
      <Label>Languages</Label>
      <CheckboxButtonGroup.Item value="en">
        <CheckboxButtonGroup.ItemContent>
          <Label>English</Label>
          <Description>Default</Description>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="es">
        <CheckboxButtonGroup.ItemContent>
          <Label>Spanish</Label>
          <Description>Beta</Description>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="de">
        <CheckboxButtonGroup.ItemContent>
          <Label>German</Label>
          <Description>Beta</Description>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
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

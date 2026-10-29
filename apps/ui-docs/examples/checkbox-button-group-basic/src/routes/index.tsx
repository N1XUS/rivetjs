// Rivet-authored CheckboxButtonGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";

export const head = { title: "CheckboxButtonGroup: Usage" };

// #region demo
export function Basic() {
  return (
    <CheckboxButtonGroup class="w-[34rem]" defaultValue={["email"]}>
      <Label>Notifications</Label>
      <CheckboxButtonGroup.Item value="email">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemContent>
          <Label>Email</Label>
          <Description>Daily summary</Description>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="push">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemContent>
          <Label>Push</Label>
          <Description>Instant alerts</Description>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="sms">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemContent>
          <Label>SMS</Label>
          <Description>Only urgent</Description>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}

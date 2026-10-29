// Rivet-authored CheckboxButtonGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Check, Circle } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";

export const head = { title: "CheckboxButtonGroup: Render Prop Children" };

// #region demo
export function RenderProps() {
  return (
    <CheckboxButtonGroup class="w-[30rem]" defaultValue={["week"]} layout="grid">
      <Label>Reminder</Label>
      <CheckboxButtonGroup.Item value="day">
        {({ isSelected }) => (
          <>
            <Icon icon={isSelected() ? Check : Circle} class="size-4 text-accent" />
            <span class="font-medium">{isSelected() ? "Every day (on)" : "Every day"}</span>
          </>
        )}
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="week">
        {({ isSelected }) => (
          <>
            <Icon icon={isSelected() ? Check : Circle} class="size-4 text-accent" />
            <span class="font-medium">{isSelected() ? "Every week (on)" : "Every week"}</span>
          </>
        )}
      </CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderProps />
    </div>
  );
}

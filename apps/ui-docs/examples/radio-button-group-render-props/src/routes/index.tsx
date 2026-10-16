// Rivet-authored RadioButtonGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Check, Circle } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export const head = { title: "RadioButtonGroup: Render Prop Children" };

// #region demo
export function RenderProps() {
  return (
    <RadioButtonGroup class="w-[30rem]" defaultValue="week" layout="grid">
      <Label>Reminder</Label>
      <RadioButtonGroup.Item value="day">
        {({ isSelected }) => (
          <>
            <Icon icon={isSelected() ? Check : Circle} class="size-4 text-accent" />
            <span class="font-medium">{isSelected() ? "Every day (on)" : "Every day"}</span>
          </>
        )}
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="week">
        {({ isSelected }) => (
          <>
            <Icon icon={isSelected() ? Check : Circle} class="size-4 text-accent" />
            <span class="font-medium">{isSelected() ? "Every week (on)" : "Every week"}</span>
          </>
        )}
      </RadioButtonGroup.Item>
    </RadioButtonGroup>
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

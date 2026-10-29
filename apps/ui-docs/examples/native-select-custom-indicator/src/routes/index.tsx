// Rivet-authored NativeSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ChevronsUpDown } from "lucide";
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: Custom Indicator" };

// #region demo
export function CustomIndicator() {
  return (
    <div class="flex w-64 flex-col gap-4">
      <NativeSelect defaultValue="medium">
        <Label>Priority</Label>
        <NativeSelect.Trigger
          indicator={
            <NativeSelect.Indicator>
              <Icon icon={ChevronsUpDown} class="size-4" />
            </NativeSelect.Indicator>
          }
        >
          <NativeSelect.Option value="low">Low</NativeSelect.Option>
          <NativeSelect.Option value="medium">Medium</NativeSelect.Option>
          <NativeSelect.Option value="high">High</NativeSelect.Option>
        </NativeSelect.Trigger>
      </NativeSelect>
      <NativeSelect defaultValue="en">
        <Label>Language (no indicator)</Label>
        <NativeSelect.Trigger indicator={null}>
          <NativeSelect.Option value="en">English</NativeSelect.Option>
          <NativeSelect.Option value="uk">Ukrainian</NativeSelect.Option>
          <NativeSelect.Option value="pl">Polish</NativeSelect.Option>
        </NativeSelect.Trigger>
      </NativeSelect>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomIndicator />
    </div>
  );
}

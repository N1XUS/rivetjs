// Rivet-authored InlineSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { InlineSelect } from "@rivetjs/ui/inline-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "InlineSelect: Multi Select" };

// #region demo
export function MultiSelect() {
  const channels = signal<readonly (string | number)[]>(["email"]);
  return (
    <p class="text-sm">
      Notify me by{" "}
      <InlineSelect selectionMode="multiple" value={channels} placeholder="nothing" aria-label="Channels">
        <InlineSelect.Trigger>
          <InlineSelect.Value />
          <InlineSelect.Indicator />
        </InlineSelect.Trigger>
        <InlineSelect.Popover>
          <ListBox>
            <ListBox.Item id="email" textValue="Email">
              Email
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="push" textValue="Push">
              Push
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="sms" textValue="SMS">
              SMS
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </InlineSelect.Popover>
      </InlineSelect>
    </p>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <MultiSelect />
    </div>
  );
}

// Rivet-authored demo: 10,000 options in an opt-in virtualized Select popover.
import { signal } from "@rivetjs/reactivity";
import { Select } from "@rivetjs/ui/select";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "Select: Virtualized" };

// #region demo
const items = Array.from({ length: 10000 }, (_, index) => ({ id: String(index), name: index === 5000 ? "Zebra" : `Item ${index}` }));

export function Virtualized() {
  const value = signal<string | number | null>(null);
  return (
    <div class="flex w-[280px] flex-col gap-3">
      <Select value={value} placeholder="Choose an item">
        <Label>10,000 items</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover class="flex max-h-[360px] flex-col overflow-hidden">
          <ListBox virtualized items={items} class="h-[288px] min-h-0" initialSize={{ width: 280, height: 288 }}>
            {(item: { id: string; name: string }) => (
              <ListBox.Item id={item.id} textValue={item.name}>
                {item.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </ListBox>
        </Select.Popover>
      </Select>
      <p class="text-sm text-muted">
        Selected key: <output id="selected-key">{value() ?? "none"}</output>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6">
      <Virtualized />
    </div>
  );
}

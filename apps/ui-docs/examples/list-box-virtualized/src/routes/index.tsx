// Rivet-authored demo: opt-in ListBox virtualization with 10,000 fixed-height options.
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "ListBox: Virtualized" };

// #region demo
const items = Array.from({ length: 10000 }, (_, index) => ({ id: String(index), name: `Item ${index + 1}` }));

export function Virtualized() {
  return (
    <ListBox virtualized aria-label="10,000 items" selectionMode="single" items={items} class="h-[288px] w-[280px]" initialSize={{ width: 280, height: 288 }}>
      {(item: { id: string; name: string }) => (
        <ListBox.Item id={item.id} textValue={item.name}>
          {item.name}
          <ListBox.ItemIndicator />
        </ListBox.Item>
      )}
    </ListBox>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Virtualized />
    </div>
  );
}

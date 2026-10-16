// Rivet addition (no upstream demo): the Select auto form (label / items) with Select.Item.
import { signal } from "@rivetjs/reactivity";
import type { Key } from "@rivetjs/cdk/select";
import { Select } from "@rivetjs/ui/select";

export const head = { title: "Select: Shorthand" };

// #region demo
export function Shorthand() {
  const fruits = [
    { id: "apple", name: "Apple" },
    { id: "banana", name: "Banana" },
    { id: "cherry", name: "Cherry" },
  ];
  const fruit = signal<Key | null>("banana");

  return (
    <div class="flex w-[256px] flex-col gap-4">
      <Select label="State" placeholder="Select one">
        <Select.Item id="florida">Florida</Select.Item>
        <Select.Item id="texas">Texas</Select.Item>
        <Select.Item id="new-york">New York</Select.Item>
      </Select>
      <Select label="Fruit" items={fruits} value={fruit}>
        {(item: { id: string; name: string }) => <Select.Item id={item.id}>{item.name}</Select.Item>}
      </Select>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shorthand />
    </div>
  );
}

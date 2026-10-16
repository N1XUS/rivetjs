import { Select } from "@rivetjs/cdk/select";

export const head = { title: "Select placement" };

const numbers = Array.from({ length: 30 }, (_, i) => ({ key: i + 1, label: "Item " + (i + 1) }));

// #region demo
export default function Placement() {
  return (
    <section class="m-4 mt-56 grid max-w-xs gap-3 text-sm">
      {/* Above the trigger, 4px away, shifted 12px along the cross axis. */}
      <Select id="up" label="Above" items={numbers.slice(0, 4)} placement="top start" offset={4} crossOffset={12} />
      {/* A long list capped at 120px (it scrolls), never flipped. */}
      <Select id="long" label="Capped" items={numbers} maxHeight={120} shouldFlip={false} />
    </section>
  );
}
// #endregion

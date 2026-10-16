import { Select } from "@rivetjs/cdk/select";

export const head = { title: "Disabled Select" };

const shipping = [
  { key: "standard", label: "Standard" },
  { key: "express", label: "Express", disabled: true },
  { key: "overnight", label: "Overnight" },
  { key: "pickup", label: "Pickup" },
];

// #region demo
export default function Shipping() {
  return (
    <section class="m-4 grid max-w-xs gap-3 text-sm">
      {/* Disabled items: `disabled` on the item or its key in disabledKeys. */}
      <Select id="ship" label="Shipping" items={shipping} disabledKeys={["pickup"]} defaultValue="standard" />
      {/* The whole select: the trigger and the hidden select are disabled. */}
      <Select id="locked" label="Locked" items={shipping} defaultValue="overnight" name="locked" isDisabled />
    </section>
  );
}
// #endregion

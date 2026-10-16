import { signal } from "@rivetjs/reactivity";
import { Select, type Key } from "@rivetjs/cdk/select";

export const head = { title: "Multiple selection" };

const toppings = [
  { key: "cheese", label: "Cheese" },
  { key: "ham", label: "Ham" },
  { key: "olives", label: "Olives" },
  { key: "pepper", label: "Pepper" },
];

// #region demo
export default function Toppings() {
  const picked = signal<readonly Key[]>(["cheese", "olives"]);
  return (
    <section class="m-4 grid max-w-xs gap-3 text-sm">
      {/* Multiple: the value is a Key[]; the popover stays open after each choice. */}
      <Select id="toppings" label="Toppings" selectionMode="multiple" items={toppings} value={picked} name="toppings" />
      <p id="toppings-out" class="text-slate-600">
        [{picked().join(", ")}]
      </p>
      {/* shouldCloseOnSelect: close after each choice anyway. */}
      <Select id="extras" label="Extras" selectionMode="multiple" items={toppings} defaultValue={[]} shouldCloseOnSelect />
      {/* A single select that stays open: shouldCloseOnSelect={false}. */}
      <Select id="base" label="Base" items={toppings} shouldCloseOnSelect={false} />
    </section>
  );
}
// #endregion

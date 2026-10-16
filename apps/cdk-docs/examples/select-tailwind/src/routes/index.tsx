import { Select } from "@rivetjs/cdk/select";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Select with Tailwind" };

const fruits = [
  { key: "apple", label: "Apple" },
  { key: "banana", label: "Banana" },
  { key: "cherry", label: "Cherry", disabled: true },
  { key: "grape", label: "Grape" },
];

const trigger =
  "flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left outline-none aria-expanded:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600";
const option =
  "flex cursor-default items-center justify-between rounded px-2 py-1 outline-none focused:bg-teal-600 focused:text-white aria-selected:font-semibold aria-disabled:opacity-40";

// #region demo
export default function Fruits() {
  return (
    <section class="m-4 grid max-w-xs gap-4 text-sm">
      {/* State variants: data-[open]: on the root, data-[placeholder]: on the value, entering: / exiting: on the popover. */}
      <Select
        id="tw"
        label="Fruit"
        items={fruits}
        class="group grid gap-1"
        labelClass="font-medium group-data-[open]:text-teal-700"
        triggerClass={trigger}
        valueClass="truncate data-[placeholder]:text-slate-400"
        popoverClass="rounded-md border border-slate-200 bg-white p-1 shadow-lg transition duration-150 entering:opacity-0 exiting:opacity-0 placement-bottom:entering:-translate-y-1"
        listClass="grid outline-none"
        optionClass={option}
        indicator={() => <Icon icon={ChevronDown} />}
      />
      {/* Headless UI transition classes on the popover: enter / enterFrom / enterTo, leave / leaveFrom / leaveTo. */}
      <Select
        id="tw2"
        label="Fruit (transition props)"
        items={fruits}
        class="grid gap-1"
        labelClass="font-medium"
        triggerClass={trigger}
        popoverClass="rounded-md border border-slate-200 bg-white p-1 shadow-lg"
        listClass="grid outline-none"
        optionClass={option}
        enter="transition duration-150 ease-out"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="transition duration-100 ease-in"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      />
    </section>
  );
}
// #endregion

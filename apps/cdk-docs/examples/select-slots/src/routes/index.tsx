import { Select } from "@rivetjs/cdk/select";
import { Check, ChevronDown, ChevronRight, ChevronUp } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Select slots" };

const plans = [
  { key: "free", label: "Free", description: "1 project" },
  { key: "pro", label: "Pro", description: "10 projects" },
  { key: "team", label: "Team", description: "Unlimited projects" },
];
const fruits = [
  { key: 1, label: "Apple" },
  { key: 2, label: "Banana" },
  { key: 3, label: "Cherry" },
];

// #region demo
export default function Plans() {
  return (
    <section class="m-4 grid max-w-xs gap-3 text-sm">
      {/* Items with a description render label + description (aria-labelledby / aria-describedby). */}
      <Select id="plan" label="Plan" items={plans} defaultValue="pro" />
      {/* children: option content, with render states; the trigger renders it too (states off).
          An element slot needs a starting value on a resumed page (see Resumability). */}
      <Select id="check" label="Plan (custom options)" items={plans} defaultValue="free">
        {(item, { isSelected, isFocused }) => (
          <span class="flex justify-between gap-2">
            <span>{item().label}</span>
            <span aria-hidden="true">{isSelected() ? <Icon icon={Check} class="check" /> : isFocused() ? <Icon icon={ChevronRight} class="focus" /> : ""}</span>
          </span>
        )}
      </Select>
      {/* renderValue: the trigger content; indicator: extra trigger content with the select's states. */}
      <Select
        id="fruit"
        label="Fruit"
        selectionMode="multiple"
        items={fruits}
        defaultValue={[1, 3]}
        renderValue={({ selectedItems, isPlaceholder }) => (isPlaceholder ? "None" : `${selectedItems.length} selected`)}
        indicator={({ isOpen }) => (
          <span id="fruit-arrow" aria-hidden="true">
            {isOpen ? <Icon icon={ChevronUp} class="up" /> : <Icon icon={ChevronDown} class="down" />}
          </span>
        )}
      />
      {/* renderEmptyState: shown in an empty list (allowsEmptyCollection lets it open). */}
      <Select id="none" label="Results" items={[]} allowsEmptyCollection renderEmptyState="No results" />
    </section>
  );
}
// #endregion

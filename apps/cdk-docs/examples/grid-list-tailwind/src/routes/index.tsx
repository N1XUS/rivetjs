import { Check } from "lucide";
import { Checkbox } from "@rivetjs/cdk/checkbox";
import { GridList, GridListItem } from "@rivetjs/cdk/grid-list";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "GridList with Tailwind" };

const animals = [
  { id: "aardvark", name: "Aardvark" },
  { id: "cat", name: "Cat" },
  { id: "dog", name: "Dog" },
  { id: "kangaroo", name: "Kangaroo" },
  { id: "panda", name: "Panda" },
];

// #region demo
export default function Animals() {
  return (
    <GridList
      id="animals"
      aria-label="Favorite animal"
      selectionMode="multiple"
      items={animals}
      disabledKeys={["kangaroo"]}
      class={({ isFocusVisible }) =>
        `m-4 grid max-w-xs gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-sm outline-none ${isFocusVisible() ? "ring-2 ring-violet-500" : ""}`
      }
    >
      {(animal: (typeof animals)[number]) => (
        <GridListItem
          textValue={animal.name}
          class={({ isSelected, isDisabled, isFocusVisible }) =>
            `flex cursor-default items-center gap-2 px-3 py-2 outline-none ${isSelected() ? "bg-violet-600 text-white" : "bg-white"} ${
              isDisabled() ? "text-slate-400" : ""
            } ${isFocusVisible() ? "relative z-10 ring-2 ring-inset ring-violet-400" : ""}`
          }
        >
          <Checkbox
            slot="selection"
            class="grid size-4 place-items-center rounded border border-slate-400 text-violet-600 data-[selected]:border-white data-[selected]:bg-white [&_svg]:invisible data-[selected]:[&_svg]:visible"
          >
            <Icon icon={Check} size={12} strokeWidth={3} class="check" />
          </Checkbox>
          {animal.name}
        </GridListItem>
      )}
    </GridList>
  );
}
// #endregion

import { ToggleButtonGroup } from "@rivetjs/cdk/toggle-button-group";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { SelectionIndicator } from "@rivetjs/cdk/selection-indicator";

export const head = { title: "Segmented control with SelectionIndicator" };

const options = ["Day", "Week", "Month"];

// #region demo
export default function Segmented() {
  return (
    <ToggleButtonGroup
      id="range"
      aria-label="Range"
      defaultSelectedKeys={["Week"]}
      disallowEmptySelection
      class="m-4 flex w-fit rounded-lg bg-slate-100 p-1 text-sm"
    >
      {() =>
        options.map((option) => (
          <ToggleButton id={option} class="relative rounded-md px-3 py-1 text-slate-600 outline-none aria-checked:text-slate-900 focus-visible:ring-2">
            <SelectionIndicator class="absolute inset-0 rounded-md bg-white shadow transition-[translate,width] duration-200 motion-reduce:transition-none" />
            <span class="relative">{option}</span>
          </ToggleButton>
        ))
      }
    </ToggleButtonGroup>
  );
}
// #endregion

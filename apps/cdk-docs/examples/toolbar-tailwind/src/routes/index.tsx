import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { Toolbar } from "@rivetjs/cdk/toolbar";

export const head = { title: "Toolbar with Tailwind" };

// #region demo
const tool =
  "rounded px-2 py-1 text-sm outline-none hover:bg-slate-200 aria-pressed:bg-slate-800 aria-pressed:text-white focus-visible:ring-2 focus-visible:ring-teal-500";

export default function View() {
  return (
    <Toolbar
      id="tw-tools"
      aria-label="View"
      class="m-4 inline-flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 orientation-horizontal:flex-row orientation-vertical:flex-col"
    >
      <ToggleButton id="tw-grid" class={tool}>
        Grid
      </ToggleButton>
      <ToggleButton id="tw-snap" class={tool}>
        Snap
      </ToggleButton>
      <ToggleButton class={tool}>Rulers</ToggleButton>
    </Toolbar>
  );
}
// #endregion

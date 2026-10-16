import { ToggleButton } from "@rivetjs/cdk/toggle-button";

export const head = { title: "ToggleButton with Tailwind" };

// #region demo
const toggle =
  "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 outline-none transition " +
  "hover:bg-slate-100 aria-pressed:border-teal-700 aria-pressed:bg-teal-700 aria-pressed:text-white " +
  "data-[pressed]:scale-95 focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50";

export default function Formatting() {
  return (
    <div class="m-4 flex gap-2">
      <ToggleButton id="tw-bold" class={toggle}>
        Bold
      </ToggleButton>
      {/* data-[selected]: is the same state as aria-pressed:. */}
      <ToggleButton id="tw-italic" class={toggle.replaceAll("aria-pressed:", "data-[selected]:")}>
        Italic
      </ToggleButton>
      <ToggleButton class={toggle} isDisabled>
        Strike
      </ToggleButton>
    </div>
  );
}
// #endregion

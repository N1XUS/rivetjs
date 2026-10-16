import { Switch } from "@rivetjs/cdk/switch";

export const head = { title: "Switch with Tailwind" };

// #region demo
// `group` on the Switch label; the track and its ::after thumb read the label's data-* state.
const root =
  "group flex cursor-pointer items-center gap-3 text-sm data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 " + "data-[readonly]:cursor-default";
const track =
  "relative h-6 w-11 rounded-full bg-slate-300 transition group-data-[hovered]:bg-slate-400 " +
  "group-data-[selected]:bg-teal-700 group-data-[selected]:group-data-[hovered]:bg-teal-800 " +
  "group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-teal-500 group-data-[focus-visible]:ring-offset-2 " +
  "after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition " +
  "group-data-[pressed]:after:w-6 group-data-[selected]:after:translate-x-5 group-data-[selected]:group-data-[pressed]:after:translate-x-4";

export default function TailwindSwitch() {
  return (
    <div class="m-4 grid gap-3">
      <Switch id="tw-sw" class={root}>
        <span class={track} aria-hidden="true" />
        Low power mode
      </Switch>
      <Switch id="tw-managed" class={root} isDisabled defaultSelected>
        <span class={track} aria-hidden="true" />
        Managed by your organisation
      </Switch>
    </div>
  );
}
// #endregion

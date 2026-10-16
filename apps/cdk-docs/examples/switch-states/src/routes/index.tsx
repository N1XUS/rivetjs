import { Switch, SwitchButton, SwitchField } from "@rivetjs/cdk/switch";

export const head = { title: "Disabled, read-only and invalid Switch" };

// #region demo
const button = "group flex cursor-pointer items-center gap-3 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50";
const track =
  "relative h-6 w-11 rounded-full bg-slate-300 transition group-data-[selected]:bg-teal-700 " +
  "group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-teal-500 group-data-[focus-visible]:ring-offset-2 " +
  "after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition " +
  "group-data-[selected]:after:translate-x-5";

export default function States() {
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <Switch id="sw-off" isDisabled class={button}>
        <span class={track} aria-hidden="true" />
        Disabled
      </Switch>
      <Switch id="sw-ro" isReadOnly defaultSelected class={button}>
        <span class={track} aria-hidden="true" />
        Read-only (stays on)
      </Switch>
      {/* isInvalid is a SwitchField prop (with validation and help text). */}
      <SwitchField id="sw-bad" isInvalid>
        <SwitchButton class={button + " data-[invalid]:text-red-700"}>
          <span class={track} aria-hidden="true" />
          Invalid
        </SwitchButton>
      </SwitchField>
      <Switch id="sw-skip" excludeFromTabOrder class={button}>
        <span class={track} aria-hidden="true" />
        Not in Tab order
      </Switch>
      <Switch id="sw-last" class={button}>
        <span class={track} aria-hidden="true" />
        Last
      </Switch>
    </section>
  );
}
// #endregion

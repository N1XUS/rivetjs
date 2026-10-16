import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Switch } from "@rivetjs/cdk/switch";

export const head = { title: "Controlled and uncontrolled Switch" };

// #region demo
// Switch is the <label>; its data-* state draws the track and thumb (the native input is visually hidden).
const button = "group flex cursor-pointer items-center gap-3 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50";
const track =
  "relative h-6 w-11 rounded-full bg-slate-300 transition group-data-[selected]:bg-teal-700 " +
  "group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-teal-500 group-data-[focus-visible]:ring-offset-2 " +
  "after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition " +
  "group-data-[selected]:after:translate-x-5";

export default function Connectivity() {
  const wifi = signal(true);
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      {/* Controlled: the signal and the switch stay in step both ways. */}
      <Switch id="wifi" isSelected={wifi} class={button}>
        <span class={track} aria-hidden="true" />
        Wi-Fi
      </Switch>
      {/* Uncontrolled: starts off. */}
      <Switch id="bt" class={button}>
        <span class={track} aria-hidden="true" />
        Bluetooth
      </Switch>
      <div class="flex gap-2">
        <Button id="airplane" onPress={() => wifi.set(false)}>
          Airplane mode
        </Button>
        <Button id="reset" onPress={() => wifi.set(true)}>
          Reset
        </Button>
      </div>
      <p id="sw-state">Wi-Fi is {wifi() ? "on" : "off"}</p>
    </section>
  );
}
// #endregion

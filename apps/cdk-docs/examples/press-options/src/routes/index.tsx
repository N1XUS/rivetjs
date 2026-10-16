import { signal } from "@rivetjs/reactivity";
import { pressProps } from "@rivetjs/cdk/interactions/press";

export const head = { title: "pressProps options" };

const box = "select-none rounded-md border border-slate-300 px-3 py-1 data-[pressed]:bg-slate-200";

// #region demo
export default function PressOptions() {
  const log = signal("none");
  const disabled = signal(true);
  const open = signal(false);
  // isDisabled is read at event time: a signal (accessor) works.
  const guarded = pressProps({ isDisabled: disabled, onPress: () => log.set("guarded") });
  // The press does not move focus (toolbars, editors that keep the caret).
  const nofocus = pressProps({ preventFocusOnPress: true, onPress: () => log.set("nofocus") });
  // Text inside stays selectable.
  const selectable = pressProps({ allowTextSelectionOnPress: true, onPress: () => log.set("selectable") });
  // Controlled press state: stays pressed while open.
  const opener = pressProps({ isPressed: open, onPress: () => open.update((v) => !v) });
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <button id="before" type="button" class="justify-self-start underline">
        Before
      </button>
      <div class="flex flex-wrap gap-2">
        <button id="toggle" type="button" class={box} onClick={() => disabled.update((v) => !v)}>
          {disabled() ? "Enable" : "Disable"}
        </button>
        <div
          id="guarded"
          role="button"
          tabIndex={0}
          {...guarded.pressProps}
          data-disabled={disabled() || undefined}
          class={box + " data-[disabled]:opacity-50"}
        >
          Guarded
        </div>
        <div id="nofocus" role="button" tabIndex={0} {...nofocus.pressProps} data-pressed={nofocus.isPressed() || undefined} class={box}>
          Keeps focus
        </div>
        <div id="selectable" role="button" tabIndex={0} {...selectable.pressProps} class={box}>
          Selectable text
        </div>
        <div
          id="opener"
          role="button"
          tabIndex={0}
          aria-expanded={open() ? "true" : "false"}
          {...opener.pressProps}
          data-pressed={opener.isPressed() || undefined}
          class={box}
        >
          Panel
        </div>
      </div>
      <output id="log">Last press: {log()}</output>
    </section>
  );
}
// #endregion

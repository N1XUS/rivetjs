import { signal } from "@rivetjs/reactivity";
import { pressProps, type PressEvent } from "@rivetjs/cdk/interactions/press";

export const head = { title: "pressProps events" };

// #region demo
export default function PressEvents() {
  const log = signal<string[]>([]);
  const changes = signal<string[]>([]);
  const count = signal(0);
  const key = signal("");
  const add = (e: PressEvent) => log.update((l) => [...l.slice(-7), `${e.type}:${e.pointerType}`]);
  const press = pressProps({
    onPressStart: (e) => add(e),
    onPressUp: (e) => add(e),
    onPressEnd: (e) => add(e),
    onPress: (e) => {
      add(e);
      count.update((n) => n + 1);
      key.set(e.key ?? "");
    },
    onPressChange: (pressed) => changes.update((l) => [...l.slice(-3), String(pressed)]),
  });
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <div
        id="target"
        role="button"
        tabIndex={0}
        {...press.pressProps}
        data-pressed={press.isPressed() || undefined}
        class="select-none justify-self-start rounded-md bg-teal-700 px-4 py-2 font-semibold text-white data-[pressed]:scale-95 data-[pressed]:bg-teal-900"
      >
        Press me
      </div>
      <p id="count">{count()} presses</p>
      <p id="key">last key: {key()}</p>
      <output id="log" class="block font-mono text-xs">
        {log().join(" ")}
      </output>
      <output id="changes" class="block font-mono text-xs">
        {changes().join(" ")}
      </output>
    </section>
  );
}
// #endregion

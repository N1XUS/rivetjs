import { signal } from "@rivetjs/reactivity";
import { longPressProps, type LongPressEvent } from "@rivetjs/cdk/interactions/long-press";

export const head = { title: "longPressProps" };

// #region demo
export default function Recorder() {
  const log = signal<string[]>([]);
  const status = signal("Idle");
  const add = (e: LongPressEvent) => log.update((l) => [...l.slice(-5), `${e.type}:${e.pointerType}`]);
  const longPress = longPressProps({
    threshold: 600,
    accessibilityDescription: "Long press to record a voice note",
    onLongPressStart: (e) => add(e),
    onLongPressEnd: (e) => add(e),
    onLongPress: (e) => {
      add(e);
      status.set("Recording…");
    },
  });
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <button id="record" type="button" {...longPress.longPressProps} class="justify-self-start rounded-full bg-rose-600 px-4 py-2 font-semibold text-white">
        Hold to record
      </button>
      {/* longPressProps returns the id; you render the description once. */}
      <span id={longPress.descriptionId} data-hint="" hidden>
        Long press to record a voice note
      </span>
      <p id="status">{status()}</p>
      <output id="log" class="block font-mono text-xs">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion

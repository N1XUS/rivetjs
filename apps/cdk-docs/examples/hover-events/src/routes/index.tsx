import { signal } from "@rivetjs/reactivity";
import { hoverProps, type HoverEvent } from "@rivetjs/cdk/interactions/hover";

export const head = { title: "hoverProps" };

// #region demo
export default function HoverCard() {
  const log = signal<string[]>([]);
  const changes = signal<string[]>([]);
  const disabled = signal(false);
  const add = (e: HoverEvent) => log.update((l) => [...l.slice(-5), `${e.type}:${e.pointerType}`]);
  const hover = hoverProps({
    isDisabled: disabled,
    onHoverStart: (e) => add(e),
    onHoverEnd: (e) => add(e),
    onHoverChange: (hovering) => changes.update((l) => [...l, String(hovering)]),
  });
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <div
        id="card"
        {...hover.hoverProps}
        data-hovered={hover.isHovered() || undefined}
        class="rounded-md border border-slate-300 p-3 transition-colors data-[hovered]:border-teal-700 data-[hovered]:bg-teal-50"
      >
        Hover the card.{" "}
        <span id="card-child" class="font-semibold">
          A child
        </span>{" "}
        keeps the hover.
      </div>
      <div class="flex gap-2">
        <button id="away" type="button" class="rounded border border-slate-300 px-2 py-1">
          Somewhere else
        </button>
        <button id="disable" type="button" class="rounded border border-slate-300 px-2 py-1" onClick={() => disabled.update((v) => !v)}>
          {disabled() ? "Enable hover" : "Disable hover"}
        </button>
      </div>
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

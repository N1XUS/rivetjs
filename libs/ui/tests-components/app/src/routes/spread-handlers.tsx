// Handlers in a spread object the component builds itself (FACTS-GAP 2026-10-27; the HoloCard root before UI-BUGS): the
// compiler facts read `on[A-Z]` keys of a locally built spread object (object literal, conditional of object literals,
// spread of such locals) as listeners, so `SpreadCard` is its own conditional boundary — a record only where a handler is
// a function (`#sh-live`), none for `#sh-static`. Before, it was no boundary: it worked here only because the route root
// adopts; in a docs frame (nothing open) it shipped no loader and did nothing.
export const head = { title: "Spread handlers" };

function SpreadCard(props: { id: string; isStatic?: boolean; children?: unknown }) {
  const { isStatic, ...rest } = props;
  const handlers = isStatic
    ? {}
    : {
        onPointerMove: (e: PointerEvent) => (e.currentTarget as HTMLElement).setAttribute("data-active", "true"),
        onPointerLeave: (e: PointerEvent) => (e.currentTarget as HTMLElement).removeAttribute("data-active"),
      };
  const attrs = { ...rest, ...handlers };
  return (
    <div class="h-40 w-64 rounded-xl border p-4" {...attrs}>
      {props.children as never}
    </div>
  );
}

export default function SpreadHandlers() {
  return (
    <div class="flex gap-8 bg-background p-10 text-foreground">
      <SpreadCard id="sh-live">live</SpreadCard>
      <SpreadCard id="sh-static" isStatic>
        static
      </SpreadCard>
    </div>
  );
}

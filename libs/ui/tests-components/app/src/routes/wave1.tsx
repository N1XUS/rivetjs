// Plan 2 wave 1 on one resumed page: every wave-1 component (T10–T13 markup from `../wave1-markup.tsx` + Link, Button, CloseButton,
// Avatar); `#w-press` increments `#w-count`; `#w-variant` toggles the live `variant={variant()}` prop of `#w-live` (live props:
// classes follow in place); `#w-markup` is a keyed region re-rendered on the client after the first press (server markup vs client markup), `#w-static`
// stays adopted. cdk Button / Link preload their resume chunks (+ this route module) on load: the "no JS before interaction" gate
// lives on `/wave1-markup`.
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Avatar } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { CloseButton } from "@rivetjs/ui/close-button";
import { Link } from "@rivetjs/ui/link";
import { ExprMarkup, FieldMarkup, Markup } from "../wave1-markup.tsx";

export const head = { title: "Wave 1" };

export default function Wave1Stories() {
  const count = signal(0);
  const variant = signal<"primary" | "secondary">("primary");
  const closed = signal(0);
  return (
    <main>
      <Link id="w-link" href="#docs">
        Docs <Link.Icon />
      </Link>
      <Avatar id="w-avatar" size="sm">
        <Avatar.Fallback>W1</Avatar.Fallback>
      </Avatar>
      <CloseButton id="w-close" onPress={() => closed.set(closed() + 1)} />
      <output id="w-closed">{closed()}</output>
      <Button id="w-press" variant="secondary" onPress={() => count.set(count() + 1)}>
        press
      </Button>
      <output id="w-count">{count()}</output>
      <button id="w-variant" type="button" onClick={() => variant.set(variant() === "primary" ? "secondary" : "primary")}>
        variant
      </button>
      <Button id="w-live" variant={variant()}>
        {variant()}
      </Button>
      <section id="w-static">
        <Markup n={-1} />
        <ExprMarkup />
        <FieldMarkup />
      </section>
      <Show when={() => count() + 1} keyed>
        {(n) => (
          <section id="w-markup">
            <Markup n={n() - 1} />
            <ExprMarkup />
            <FieldMarkup />
          </section>
        )}
      </Show>
    </main>
  );
}

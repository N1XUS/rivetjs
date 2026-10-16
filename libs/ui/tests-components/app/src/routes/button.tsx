// Button / CloseButton / Link on a resumed page: `onPress` runs after the first click, `isPending` / `isDisabled` accessors follow
// signals without re-creating the button, `render` swaps the element, CloseButton press + Link anchor.
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { CloseButton } from "@rivetjs/ui/close-button";
import { Link } from "@rivetjs/ui/link";

export default function ButtonStories() {
  const count = signal(0);
  const pending = signal(false);
  const closed = signal(0);
  return (
    <main>
      <Button id="b-press" variant="secondary" onPress={() => count.set(count() + 1)}>
        press
      </Button>
      <output id="b-count">{count()}</output>
      <Button id="b-pending" isPending={() => pending()} onPress={() => pending.set(!pending())}>
        {({ isPending }) => (isPending() ? "busy" : "idle")}
      </Button>
      <Button id="b-render" render={(props) => <a {...(props as {})} href="#anchor" />}>
        as link
      </Button>
      <CloseButton id="b-close" onPress={() => closed.set(closed() + 1)} />
      <output id="b-closed">{closed()}</output>
      <Link id="l-docs" href="#docs">
        Docs <Link.Icon />
      </Link>
    </main>
  );
}

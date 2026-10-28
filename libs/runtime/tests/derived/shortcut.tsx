import { signal } from "@rivetjs/reactivity";
import { clientEvent } from "@rivetjs/runtime/dom";

// AppLayout's shape: a nonfocusable click target, a delegated wrapper shortcut, and a window listener installed by adoption.
const handled = new WeakSet<Event>();
export function Shortcut() {
  const clicks = signal(0);
  const keys = signal(0);
  const keydown = (event: KeyboardEvent) => {
    if (handled.has(event) || !event.ctrlKey || !event.shiftKey || event.code !== "KeyE") return;
    handled.add(event);
    event.preventDefault();
    keys.set(keys() + 1);
  };
  clientEvent(window, "keydown", keydown, { preload: "interaction", standalone: false });
  return (
    <main onKeyDown={keydown}>
      <h1 id="start" onClick={() => clicks.set(clicks() + 1)}>
        Start
      </h1>
      <button id="inside" type="button">
        Focus inside
      </button>
      <output id="clicks">{clicks()}</output>
      <output id="keys">{keys()}</output>
    </main>
  );
}

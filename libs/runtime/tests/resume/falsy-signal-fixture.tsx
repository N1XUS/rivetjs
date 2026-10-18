// A resumed signal holding a falsy value (resume-falsy-signal-browser.test.ts): arming it must not take the value for
// a region id — a counter at `0` named region 0 (the page's first region), whose re-creation reset it to `undefined`.
import { signal } from "@rivetjs/reactivity";

export function Page() {
  const clicks = signal(0);
  const seen = signal(-1);
  return (
    <div>
      <Panel />
      <button id="peek" onClick={() => seen.set(clicks())}>
        peek
      </button>
      <button id="count" onClick={() => clicks.update((n) => n + 1)}>
        count
      </button>
      <output id="clicks">{clicks()}</output>
      <output id="seen">{seen()}</output>
    </div>
  );
}
// The page's first region (id 0): its ternary re-creates it on the first toggle.
function Panel() {
  const open = signal(false);
  return (
    <section>
      {open() ? <b id="state">open</b> : <i id="state">closed</i>}
      <button id="toggle" onClick={() => open.set(!open())}>
        toggle
      </button>
    </section>
  );
}

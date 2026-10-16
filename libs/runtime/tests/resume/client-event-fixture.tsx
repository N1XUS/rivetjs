// Resume: document / window clientEvent listeners must be in place for the first interaction's
// handlers (a toast queued by the first click dispatches a document event at once).
// `Links`: a document listener with `match` (the router's link listeners) — runs, and loads its chunk,
// only for events inside a matching element.
import { signal } from "@rivetjs/reactivity";
import { clientEvent } from "@rivetjs/runtime/server";

export function Page() {
  const pings = signal(0);
  const sizes = signal(0);
  clientEvent(document, "rv:ping", () => pings.update((n) => n + 1));
  clientEvent(window, "rv:size", () => sizes.update((n) => n + 1));
  return (
    <main>
      <button
        id="ping"
        onClick={() => {
          document.dispatchEvent(new CustomEvent("rv:ping"));
          window.dispatchEvent(new CustomEvent("rv:size"));
        }}
      >
        ping
      </button>
      <p id="pings">{pings()}</p>
      <p id="sizes">{sizes()}</p>
      <p id="text">plain text</p>
      <Links />
    </main>
  );
}

export function Links() {
  const hits = signal(0);
  const overs = signal(0);
  const onces = signal(0);
  const firsts = signal(0);
  // Intent listeners like the router's: the runtime boots on intent and replays it only when it matches.
  clientEvent(document, "pointerover", () => overs.update((n) => n + 1), { passive: true, preload: "intent", match: "a,form" });
  clientEvent(document, "focusin", () => overs.update((n) => n + 1), { preload: "intent", match: "a,form" });
  // `once` + `match` on an intent type: a replayed boot intent that matches consumes it.
  clientEvent(document, "pointerover", () => firsts.update((n) => n + 1), { passive: true, preload: "intent", once: true, match: "#nav" });
  // `once` + `match`: the first MATCHING click removes it, not the first click.
  clientEvent(document, "click", () => onces.update((n) => n + 1), { preload: "intent", once: true, match: "#once" });
  clientEvent(
    document,
    "click",
    (event) => {
      event.preventDefault();
      hits.update((n) => n + 1);
    },
    { preload: "intent", match: "a" },
  );
  return (
    <div>
      <a id="go" href="#go">
        go <b id="inner">in</b>
      </a>
      <span id="hits">{hits()}</span>
      <a id="nav" href="/nav">
        nav
      </a>
      <button id="once" type="button">
        once
      </button>
      <span id="onces">{onces()}</span>
      <span id="overs">{overs()}</span>
      <span id="firsts">{firsts()}</span>
      <form id="form" onSubmit={(event) => event.preventDefault()}>
        <input id="field" />
      </form>
    </div>
  );
}

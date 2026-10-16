// Lane R2 fixes: function children of native elements (`{() => log().join()}`) bind like plain
// expressions on resumed pages.
import { signal } from "@rivetjs/reactivity";

export function FnChild() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  return (
    <main>
      <button id="add" onClick={() => add("x" + log().length)}>
        add
      </button>
      <p id="text">{() => log().join(", ")}</p>
      <ol id="list">{() => log().map((entry) => <li>{entry}</li>)}</ol>
      <p id="plain">{log().join(" | ")}</p>
    </main>
  );
}

// A warm cancelable event queued behind a cold one (K1): `invalid` on #a (loaded) focuses #b, whose
// focusin handler's chunk is slow → cold chain; the following `invalid` on #c (loaded) must still be
// canceled at dispatch.
export function Invalid() {
  const seen = signal("");
  return (
    <form id="form" onSubmit={(event) => event.preventDefault()}>
      <button type="button" id="warm" onClick={() => seen.set(seen() + "w")}>
        warm
      </button>
      <input
        id="a"
        required
        onInvalid={(event) => {
          event.preventDefault();
          document.getElementById("b")!.focus();
        }}
      />
      <Other />
      <input id="c" required onInvalid={(event) => (event.preventDefault(), seen.set(seen() + "c"))} />
      <output id="seen">{seen()}</output>
      <button id="submit">send</button>
    </form>
  );
}

function Other() {
  const focused = signal(0);
  return (
    <button type="button" id="b" onFocusIn={() => focused.set(focused() + 1)}>
      {focused()}
    </button>
  );
}

// Function children inside a component's returned fragment: the component's region wakes on their reads.
function Hidden({ keys }: { keys: () => string[] }) {
  return <>{() => keys().map((key) => <input type="hidden" name="k" value={key} />)}</>;
}
function Joined({ keys }: { keys: () => string[] }) {
  return (
    <>
      <b>keys:</b>
      {() => keys().join(",")}
    </>
  );
}
export function FragmentFn() {
  const keys = signal(["a"]);
  return (
    <form id="frag">
      <button type="button" id="more" onClick={() => keys.set([...keys(), "b"])}>
        more
      </button>
      <Hidden keys={keys} />
      <span id="joined">
        <Joined keys={keys} />
      </span>
    </form>
  );
}

// A resumed spread with a React-style `tabIndex` key (K4): the server rendered `tabindex`; the first
// run must update it in place, never remove it (Chrome blurs a focused element that loses tabindex).
export function SpreadCase() {
  const on = signal(false);
  const props = { tabIndex: () => (on() ? 0 : -1), readOnly: () => on(), onClick: () => on.set(true) };
  return <input id="cell" {...props} />;
}

// A cold submit click replays before the form's (slow) `invalid` handler chunk loaded: the loader cancels the
// `invalid`s; once their handler ran without canceling, the first invalid control takes focus (native default).
export function ColdInvalid() {
  const seen = signal(0);
  return (
    <form id="cold-form" onSubmit={(event) => event.preventDefault()} onInvalidCapture={() => seen.set(seen() + 1)}>
      <input id="x" required />
      <input id="y" required />
      <output id="invalids">{seen()}</output>
      <SendButton />
    </form>
  );
}

function SendButton() {
  const sent = signal(0);
  return (
    <button id="send" onClick={() => sent.set(sent() + 1)}>
      send {sent()}
    </button>
  );
}

// Cold keys: "a" on #k1 moves focus to #k2 (as a date segment does); "b" and "c", dispatched at #k1 before the chunk
// loaded, replay at #k2 like on a live page.
export function ColdKeys() {
  const log = signal("");
  return (
    <div>
      <input
        id="k1"
        onKeyDown={(event) => {
          event.preventDefault();
          log.set(log() + " k1:" + event.key);
          document.getElementById("k2")!.focus();
        }}
      />
      <input
        id="k2"
        onKeyDown={(event) => {
          event.preventDefault();
          log.set(log() + " k2:" + event.key + ((event.target as Element).id === "k2" ? "" : "!"));
        }}
      />
      <output id="keys">{log()}</output>
    </div>
  );
}

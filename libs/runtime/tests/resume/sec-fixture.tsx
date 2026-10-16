// Lane SEC (round-2 review) resume fixtures: injected markup (U2, SEC1), cold click defaults (C8) and a
// failing cold dispatch (C7).
import { signal } from "@rivetjs/reactivity";

export function Counter() {
  const n = signal(0);
  const text = signal("a");
  return (
    <main>
      <button id="bump" onClick={() => n.set(n() + 1)}>
        {n()}
      </button>
      <input id="field" model:value={text} />
      <output id="echo">{text()}</output>
    </main>
  );
}

// C8: a cold click's default (toggle, submit, details open) waits for the handler, which may cancel it.
export function Defaults() {
  const log = signal("");
  const add = (entry: string) => log.set(log() + entry);
  return (
    <main>
      <input type="checkbox" id="keep" onClick={(event) => (event.preventDefault(), add("k"))} />
      <input type="checkbox" id="toggle" onClick={() => add("t")} onChange={() => add("c")} />
      {/* RA useToggle shape: the label's handler cancels the label click and toggles through its own press. */}
      <label id="lbl" onClick={(event) => {
          event.preventDefault();
          const box = document.getElementById("lbx") as HTMLInputElement;
          box.checked = !box.checked;
          add("l");
        }}>
        <input type="checkbox" id="lbx" />
        <span id="lbl-text">label</span>
      </label>
      <details id="d1">
        <summary id="s1" onClick={(event) => (event.preventDefault(), add("d"))}>
          stays closed
        </summary>
        one
      </details>
      <details id="d2">
        <summary id="s2" onClick={() => add("o")}>
          opens
        </summary>
        two
      </details>
      <form id="form" action="/submitted">
        <input name="q" value="x" />
        <button id="send" onClick={(event) => (event.preventDefault(), add("s"))}>
          held
        </button>
        <button id="go" name="via" value="go" onClick={() => add("g")}>
          submits
        </button>
      </form>
      <output id="log">{log()}</output>
    </main>
  );
}

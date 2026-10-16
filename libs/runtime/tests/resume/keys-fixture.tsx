import { signal } from "@rivetjs/reactivity";

// A composite widget listing its keys in data-rk, and the same widget without the hint.
export function Keys() {
  const n = signal(0);
  const m = signal(0);
  return (
    <div>
      <div id="held" tabIndex={0} data-rk="ArrowDown Space" onKeyDown={(event) => (event.key === "ArrowDown" || event.key === " ") && n.update((v) => v + 1)}>
        held
      </div>
      <div id="plain" tabIndex={0} onKeyDown={(event) => event.key === "ArrowDown" && m.update((v) => v + 1)}>
        plain
      </div>
      <input id="field" />
      <div id="keep" onMouseDown={(event) => event.preventDefault()}>
        keep focus
      </div>
      <p id="n">{n()}</p>
      <p id="m">{m()}</p>
      <pre>{"line\n".repeat(400)}</pre>
    </div>
  );
}

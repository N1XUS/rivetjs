import { signal } from "@rivetjs/reactivity";

// G9 select: `value` / `model:value` on <select> select the matching option on every target.
const sizes = ["s", "m", "l"];

export function StaticSelect() {
  return (
    <select id="static" value="b">
      <option value="a">A</option>
      <option value="b">B</option>
      <option> c </option>
    </select>
  );
}

export function TextSelect() {
  return (
    <select id="text" value={"c"}>
      <optgroup label="g">
        <option value="a">A</option>
        <option> c </option>
      </optgroup>
    </select>
  );
}

export function MappedSelect() {
  const size = signal("l");
  return (
    <main>
      <select id="mapped" value={size()}>
        {sizes.map((s) => (
          <option value={s}>{s.toUpperCase()}</option>
        ))}
      </select>
      <button id="pick-s" onClick={() => size.set("s")}>s</button>
    </main>
  );
}

export function MultipleSelect() {
  return (
    <select id="multiple" multiple value={["a", "c"]}>
      <option value="a">A</option>
      <option value="b">B</option>
      <option value="c">C</option>
    </select>
  );
}

export function ModelSelect() {
  const size = signal("m");
  return (
    <main>
      <select id="model" model:value={size}>
        {sizes.map((s) => (
          <option value={s}>{s}</option>
        ))}
      </select>
      <output id="model-out">{size()}</output>
      <button id="model-l" onClick={() => size.set("l")}>l</button>
    </main>
  );
}

export function ModelMultiple() {
  const picked = signal(["b"]);
  return (
    <main>
      <select id="model-multiple" multiple model:value={picked}>
        <option value="a">A</option>
        <option value="b">B</option>
        <option value="c">C</option>
      </select>
      <output id="multiple-out">{picked().join(",")}</output>
    </main>
  );
}

/** Options arrive after the select's value: the value applies once they exist. */
export function LateOptions() {
  const options = signal<string[]>([]);
  const value = signal("y");
  return (
    <main>
      <select id="late" model:value={value}>
        {options().map((o) => (
          <option value={o}>{o}</option>
        ))}
      </select>
      <button id="load" onClick={() => options.set(["x", "y", "z"])}>load</button>
    </main>
  );
}

// G9 custom elements: `on:name` listens for custom events (any case), `prop:x` sets properties.
export function Custom() {
  const hits = signal(0);
  const items = signal(["a"]);
  return (
    <main>
      <x-probe
        id="probe"
        prop:items={items()}
        prop:label="hello"
        on:probe-hit={(event) => hits.set(hits() + (event.detail as number))}
        on:camelHit={() => hits.set(hits() + 100)}
      />
      <output id="hits">{hits()}</output>
      <a id="unsafe" prop:href={["javascript", "alert(1)"].join(":")}>x</a>
      <button id="more" onClick={() => items.set([...items(), "b"])}>more</button>
    </main>
  );
}

// G9 checks: dialog/details events from lib.dom; prop:indeterminate on a checkbox.
export function Dialogs() {
  const log = signal("");
  const mixed = signal(true);
  return (
    <main>
      <dialog id="dlg" onClose={() => log.set(log() + "close;")} onCancel={() => log.set(log() + "cancel;")}>
        x
      </dialog>
      <details id="det" onToggle={(event) => log.set(log() + "toggle:" + event.newState + ";")}>
        <summary id="sum">s</summary>b
      </details>
      <input id="mixed" type="checkbox" prop:indeterminate={mixed()} />
      <button id="unmix" onClick={() => mixed.set(false)}>u</button>
      <output id="log">{log()}</output>
    </main>
  );
}

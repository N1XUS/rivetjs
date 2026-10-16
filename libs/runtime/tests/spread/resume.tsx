// Resume-compiled spread (spread.test.ts): a spread reading signals is a resumable attribute binding.
import { signal } from "@rivetjs/reactivity";

function Shell(props: { children?: string }) {
  return <b id="shell">{props.children}</b>;
}
// A component spreading its props (`dom.*` in @rivetjs/ui): the children slot passes through the spread object.
function Box(props: Record<string, unknown>) {
  return <section {...props} />;
}
export function Page() {
  (globalThis as any).__componentRuns = ((globalThis as any).__componentRuns ?? 0) + 1;
  const on = signal(true);
  const n = signal(1);
  const extra = { "data-kind": "box" };
  const fnjsx = { title: () => "t" + n(), children: () => <b id="fnjsxkid">kid</b> };
  const fnjsxn = {
    title: () => "t" + n(),
    children: () =>
      on() ? (
        <b id="fnjsxnkid" data-n={n()}>
          on
        </b>
      ) : (
        <i id="fnjsxnkid">off</i>
      ),
  };
  return (
    <main>
      <button id="toggle" onClick={() => on.set(!on())}>
        toggle
      </button>
      <button id="inc" onClick={() => n.set(n() + 1)}>
        inc
      </button>
      <div id="box" class="base" {...extra} {...(on() ? { title: "on", "aria-pressed": "true" } : { hidden: true })} data-n={n()}>
        box
      </div>
      <span id="static" {...extra}>
        static
      </span>
      <p id="kids" {...(on() ? { children: "on " + n() } : { title: "off", children: ["off", n()] })} />
      <p id="kept" {...(on() ? { children: "lost" } : {})}>
        explicit
      </p>
      <p id="fixed" {...{ children: "fixed" }} />
      <Shell {...{ children: "via" }} />
      {/* Children kept across attribute-only changes (re-inserted only when `children` itself changes). */}
      <Box id="rbox" class={() => "c" + n()}>
        <span id="rkid">kid</span>
      </Box>
      <Box id="rtext" class={() => "c" + n()}>
        {"t" + n()}
      </Box>
      <p id="fnkid" {...{ title: () => "t" + n(), children: () => "f" + n() }} />
      {/* Function `children` alone (no accessor attribute beside it): the resumed site is still captured. */}
      <Box id="rfn">{() => "g" + n()}</Box>
      <p id="fnonly" {...{ children: () => "h" + n() }} />
      {/* Function `children` holding JSX next to accessor attributes (cdk `render` roots: `children: () => <Provider>…rows…</Provider>`):
          its own child site (` #r`), so the spread's attribute re-run keeps the server nodes; its own reads update the site alone. */}
      <p id="fnjsx" {...fnjsx} />
      <p id="fnjsxn" {...fnjsxn} />
      {/* Accessor values (cdk contexts pass reactive aria-invalid / value this way): read on the server, tracked by the resumed binding. */}
      <input id="acc" {...{ "aria-invalid": () => (on() ? "true" : undefined), value: () => "v" + n() }} />
      {/* style objects in a spread: encoded like an explicit style={obj}, written through CSSOM by the resumed binding. */}
      <i id="sty" {...{ style: () => ({ color: on() ? "red" : "blue", "--n": n() }) }} />
    </main>
  );
}

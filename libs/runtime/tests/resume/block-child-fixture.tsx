// Block-bodied function children (`../resume-closures-browser.test.ts`): `{() => { const v = s(); return …; }}` is a resume
// Bind site like a concise `{() => expr}` (compiler `resume.rs` `function_child`, 3c980706) — on a native element and among
// a component's lazy children. A component's LONE function child (`<Box>{() => …}</Box>`) is its slot function, rendered
// through `{props.children}`: the server `_rChild` makes it its own child site, so reads in its body (concise or block)
// re-run it after resume; one reading only inside its JSX keeps its nodes (inner binds update them).
import { signal } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";

function Box(props: { children?: unknown }) {
  return <div class="box">{props.children}</div>;
}
function Lazy(props: { n: Signal<number> }) {
  return (
    <Box>
      {() => {
        const v = props.n() * 2;
        return <i class="lazy">{v}</i>;
      }}
      {() => <s class="concise">{props.n() * 3}</s>}
    </Box>
  );
}
/** A lone block child: the component's `children` is the function itself (a slot function), not a lazy group. */
function Lone(props: { n: Signal<number> }) {
  return (
    <Box>
      {() => {
        const v = props.n() * 5;
        return <em class="lone">{v}</em>;
      }}
    </Box>
  );
}
/** A lone concise child reading in its body (outside its JSX). */
function LoneConcise(props: { n: Signal<number> }) {
  return <Box>{() => (props.n() % 2 ? <q class="lone">odd</q> : <q class="lone">even</q>)}</Box>;
}
function Outer(props: { children?: unknown }) {
  return <div class="outer">{props.children}</div>;
}
/** The slot function inside another component's children. */
function Nested(props: { n: Signal<number> }) {
  return (
    <Outer>
      <Box>
        {() => {
          if (props.n() > 1) return <ins class="lone">many</ins>;
          return <del class="lone">one</del>;
        }}
      </Box>
    </Outer>
  );
}
/** Reads only inside its JSX: no own site, the `<p>` stays the server node. */
function Keep(props: { n: Signal<number> }) {
  return <Box>{() => <p class="keep">{props.n()}</p>}</Box>;
}

export function Page() {
  const n = signal(1);
  return (
    <section>
      <div class="native">
        {() => {
          const v = n();
          if (v % 2) return <b>odd {v}</b>;
          return <u>even {v}</u>;
        }}
      </div>
      <Lazy n={n} />
      <Lone n={n} />
      <LoneConcise n={n} />
      <Nested n={n} />
      <Keep n={n} />
      <button class="go" onClick={() => n.set(n() + 1)}>
        go
      </button>
    </section>
  );
}

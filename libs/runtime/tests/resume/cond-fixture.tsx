// "Maybe nothing" conditionals: every component renders `<section id><button class="t"/><div class="o">…</div></section>`;
// the button flips `c` (initial value `init`), the test reads `.o` after each flip — server, resume and client.
import { signal } from "@rivetjs/reactivity";
import { For, Provider, Show } from "@rivetjs/runtime/dom";
import { createContext } from "@rivetjs/reactivity";

const Theme = createContext("light");

interface Props {
  id: string;
  init: boolean;
}

export function And({ id, init }: Props) {
  const c = signal(init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">{c() && <p>yes</p>}</div>
    </section>
  );
}

export function TernNull({ id, init }: Props) {
  const c = signal(init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">{c() ? <p>yes</p> : null}</div>
    </section>
  );
}

export function TernFalse({ id, init }: Props) {
  const c = signal(init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">{c() ? <p>yes</p> : false}</div>
    </section>
  );
}

export function TernUndefined({ id, init }: Props) {
  const c = signal(init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">{c() ? <p>yes</p> : undefined}</div>
    </section>
  );
}

// `c` true → `true` (renders nothing); false → the JSX.
export function Or({ id, init }: Props) {
  const c = signal(!init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">{c() || <p>yes</p>}</div>
    </section>
  );
}

// null → the JSX; a string → that text.
export function Nullish({ id, init }: Props) {
  const v = signal<string | null>(init ? null : "val");
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => v.set(v() === null ? "val" : null)}>
        t
      </button>
      <div class="o">{v() ?? <p>yes</p>}</div>
    </section>
  );
}

export function Nested({ id, init }: Props) {
  const c = signal(init);
  const d = signal(true);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">{c() && d() && <p>yes</p>}</div>
    </section>
  );
}

export function Parenthesized({ id, init }: Props) {
  const c = signal(init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">{c() && <p>yes</p>}</div>
    </section>
  );
}

function Box(props: { children?: unknown }) {
  return <div class="o">{props.children}</div>;
}

// Inside a component's children.
export function Child({ id, init }: Props) {
  const c = signal(init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <Box>{c() && <p>yes</p>}</Box>
    </section>
  );
}

// Inside `For` rows.
export function Rows({ id, init }: Props) {
  const c = signal(init);
  const items = ["a", "b"];
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <ul class="o">
        <For each={() => items} by={(item: string) => item}>
          {(item: () => string) => (
            <li>
              {item()}
              {c() && <b>!</b>}
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}

// A text sibling on both sides.
export function Sibling({ id, init }: Props) {
  const c = signal(init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">a {c() && <b>yes</b>} b</div>
    </section>
  );
}

// JSX behind a call (no static JSX operand): a string first, a node later — or the reverse.
export function Dynamic({ id, init }: Props) {
  const c = signal(init);
  const view = () => (c() ? <b>node</b> : "text");
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">{view()}</div>
    </section>
  );
}

// JSX behind a call, nothing (null) in the other case.
export function DynamicNull({ id, init }: Props) {
  const c = signal(init);
  const view = () => (c() ? <b>node</b> : null);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">{view()}</div>
    </section>
  );
}

// Behind a call, next to static siblings (a text binding between other children, not a sole child).
export function DynamicSibling({ id, init }: Props) {
  const c = signal(init);
  const view = () => (c() ? <b>node</b> : false);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">
        <i>x</i>
        {view()}
        <i>y</i>
      </div>
    </section>
  );
}

// Text directly among a component's children.
export function ChildText({ id, init }: Props) {
  const c = signal(init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <Box>{c() ? "on" : "off"}</Box>
    </section>
  );
}

// The `<></>` "nothing" branch directly among a component's children.
export function ChildFragment({ id, init }: Props) {
  const c = signal(init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <Box>{c() ? <p>yes</p> : <></>}</Box>
    </section>
  );
}

// Next to a static element among a component's children.
export function ChildMixed({ id, init }: Props) {
  const c = signal(init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <Box>
        <i>x</i>
        {c() && <p>yes</p>}
      </Box>
    </section>
  );
}

// JSX behind a call among a component's children.
export function ChildDynamic({ id, init }: Props) {
  const c = signal(init);
  const view = () => (c() ? <b>node</b> : "text");
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <Box>{view()}</Box>
    </section>
  );
}

function Frag(props: { c: () => boolean }) {
  return <>{props.c() && <p>yes</p>}</>;
}

// A component whose fragment root holds the conditional.
export function FragmentRoot({ id, init }: Props) {
  const c = signal(init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">
        <Frag c={c} />
      </div>
    </section>
  );
}

function Leaf() {
  return <p>yes</p>;
}

// A component element as the JSX operand.
export function ComponentOperand({ id, init }: Props) {
  const c = signal(init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">{c() && <Leaf />}</div>
    </section>
  );
}

// `&&` nested inside a ternary branch.
export function TernaryAnd({ id, init }: Props) {
  const c = signal(init);
  const d = signal(true);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">{c() ? d() && <p>yes</p> : null}</div>
    </section>
  );
}

// JSX behind a call inside `For` rows.
export function RowsDynamic({ id, init }: Props) {
  const c = signal(init);
  const items = ["a", "b"];
  const mark = () => (c() ? <b>!</b> : "");
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <ul class="o">
        <For each={() => items} by={(item: string) => item}>
          {(item: () => string) => (
            <li>
              {item()}
              {mark()}
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}

// Directly among a framework component's children: `Show` content and `Provider` children.
export function ShowChild({ id, init }: Props) {
  const c = signal(init);
  const on = signal(true);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">
        <Show when={on}>{c() && <p>yes</p>}</Show>
      </div>
    </section>
  );
}

export function ProviderChild({ id, init }: Props) {
  const c = signal(init);
  return (
    <section id={id}>
      <button type="button" class="t" onClick={() => c.set(!c())}>
        t
      </button>
      <div class="o">
        <Provider token={Theme} value="dark">
          {c() && <p>yes</p>}
        </Provider>
      </div>
    </section>
  );
}

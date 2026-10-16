// Resumed pages: code the browser evaluates later from decoded state sees the identified providers that enclosed its
// creation on the server (lane RESUME-CTX). One page per shape (`resume-owner-context-browser.test.ts`).
import { computed, createContext, signal, useContext } from "@rivetjs/reactivity";
import { For, Provider, Show } from "@rivetjs/runtime/dom";
import { resumableContext } from "@rivetjs/runtime/resume-format";

const Ctx = resumableContext(createContext<{ name: string }>({ name: "none" }, { id: "oc-ctx" }));
const Outer = resumableContext(createContext<{ name: string }>({ name: "none" }, { id: "oc-outer" }));

/** A captured computed created inside a provider reads the context while it evaluates (re-run in the browser). */
function Label() {
  const n = signal(0);
  const label = computed(() => useContext(Ctx).name + ":" + n());
  return (
    <section>
      <span class="out">{label()}</span>
      <button class="go" onClick={() => n.set(n() + 1)}>
        go
      </button>
    </section>
  );
}
export function ComputedCtx() {
  return (
    <Provider token={Ctx} value={{ name: "ctx" }}>
      <Label />
    </Provider>
  );
}

/** cdk collection shape: a computed runs a wrapper component's body (build pass), the wrapper reads a context there. */
function Wrapped(props: { id: number }) {
  const context = useContext(Ctx);
  return context.name + props.id;
}
function List() {
  const count = signal(2);
  const rows = computed(() => Array.from({ length: count() }, (_, id) => Wrapped({ id })).join(","));
  return (
    <section>
      <span class="out">{rows()}</span>
      <button class="go" onClick={() => count.set(count() + 1)}>
        go
      </button>
    </section>
  );
}
export function CollectionCtx() {
  return (
    <Provider token={Ctx} value={{ name: "row" }}>
      <List />
    </Provider>
  );
}

/** Two nested providers (outer around the page, inner around the component): both reach the computed. */
function Both() {
  const n = signal(0);
  const label = computed(() => useContext(Outer).name + "/" + useContext(Ctx).name + ":" + n());
  return (
    <section>
      <span class="out">{label()}</span>
      <button class="go" onClick={() => n.set(n() + 1)}>
        go
      </button>
    </section>
  );
}
export function NestedCtx() {
  return (
    <Provider token={Outer} value={{ name: "o" }}>
      <Provider token={Ctx} value={{ name: "i" }}>
        <Both />
      </Provider>
    </Provider>
  );
}

/** `For` rows re-created inside a provider read the context in their body. */
function Row(props: { x: string }) {
  const context = useContext(Ctx);
  return <i class="row">{context.name + props.x}</i>;
}
function Rows() {
  const xs = signal(["a", "b"]);
  return (
    <section>
      <div class="out">
        <For each={xs()} by={(x) => x}>
          {(x) => <Row x={x()} />}
        </For>
      </div>
      <button class="go" onClick={() => xs.set([...xs(), "c"])}>
        go
      </button>
    </section>
  );
}
export function ForCtx() {
  return (
    <Provider token={Ctx} value={{ name: "f" }}>
      <Rows />
    </Provider>
  );
}

/** A `Show` branch created after resume inside a provider. */
function Toggle() {
  const on = signal(false);
  return (
    <section>
      <div class="out">
        <Show when={on()}>{() => <Row x="!" />}</Show>
      </div>
      <button class="go" onClick={() => on.set(!on())}>
        go
      </button>
    </section>
  );
}
export function ShowCtx() {
  return (
    <Provider token={Ctx} value={{ name: "s" }}>
      <Toggle />
    </Provider>
  );
}

/** A captured local function reading the context, called by a binding (known limit: bindings run without providers). */
function Called() {
  const n = signal(0);
  const name = () => useContext(Ctx).name;
  return (
    <section>
      <span class="out">{name() + ":" + n()}</span>
      <button class="go" onClick={() => n.set(n() + 1)}>
        go
      </button>
    </section>
  );
}
export function FnCtx() {
  return (
    <Provider token={Ctx} value={{ name: "fn" }}>
      <Called />
    </Provider>
  );
}

/** A computed created outside any provider keeps the defaults (no providers recorded). */
export function NoProvider() {
  return <Label />;
}

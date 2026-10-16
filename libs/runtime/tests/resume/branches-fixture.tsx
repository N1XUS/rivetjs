// Region branches fixture (`../resume-branches-browser.test.ts`): several Shows / Switches created directly by one region read.
// The server records a branch per direct Show/Switch (slot = creation order); the browser's re-creation adopts each in order.
// `.go` changes the case's signal; elements carry classes the test marks to check node identity.
import { signal } from "@rivetjs/reactivity";
import { For, Match, Show, Switch } from "@rivetjs/runtime/dom";

/** Shows around a keyed For in one region: rows and every branch whose match holds keep their nodes. */
export function Mix() {
  const n = signal(1);
  const list = signal(["a", "b"]);
  // A call child: the region site whose read creates every Show directly.
  const body = () => [
    <Show when={() => n() >= 1}>{() => <b class="s s1">1</b>}</Show>,
    <For each={list} by={(x: string) => x}>
      {(x: () => string) => <i class={"row " + x()}>{x()}</i>}
    </For>,
    <Show when={() => n() >= 2}>{() => <b class="s s2">2</b>}</Show>,
    <Show when={() => n() >= 1} fallback={<u class="f">f</u>}>
      {() => <b class="s s3">3</b>}
    </Show>,
  ];
  return (
    <section>
      <div class="box">{body()}</div>
      <button class="go" onClick={() => n.set(n() === 1 ? 2 : 1)}>
        go
      </button>
      <button class="add" onClick={() => list.set([...list(), "c"])}>
        add
      </button>
    </section>
  );
}

/** A Show inside another Show's branch is not direct (no slot): the later direct Shows still get their own branch, and its
 * condition (another signal) re-creates the region without costing them their adoption. */
export function Nested() {
  const m = signal(1);
  const k = signal(1);
  const on = true;
  // A call child: the region site whose read creates every Show directly.
  const body = () => [
    <Show when={on}>
      {() => (
        <Show when={() => k() > 1} fallback={<span class="in-f">f</span>}>
          {() => <span class="in">in</span>}
        </Show>
      )}
    </Show>,
    <Show when={() => m() > 0}>{() => <b class="second">2nd</b>}</Show>,
    <Show when={() => m() > 0}>{() => <b class="third">3rd</b>}</Show>,
  ];
  return (
    <section>
      <div class="nest">{body()}</div>
      <button class="go" onClick={() => k.set(k() === 1 ? 2 : 1)}>
        go
      </button>
    </section>
  );
}

/** Keyed Shows and a Switch: a branch whose value / match changed is rebuilt, the others are kept. */
export function Keyed() {
  const a = signal("x");
  const b = signal("y");
  // A call child: the region site whose read creates every Show directly.
  const body = () => [
    <Show when={() => a()} keyed>
      {(v: () => string) => <b class="ka">{v()}</b>}
    </Show>,
    <Show when={() => b()} keyed>
      {(v: () => string) => <b class="kb">{v()}</b>}
    </Show>,
    <Switch fallback={<i class="sw-f">none</i>}>
      <Match when={() => a() === "x"}>{() => <i class="sw-x">x</i>}</Match>
      <Match when={() => a() === "z"}>{() => <i class="sw-z">z</i>}</Match>
    </Switch>,
    <Show when={() => b() === "y"}>{() => <i class="by">by</i>}</Show>,
  ];
  return (
    <section>
      <div class="k">{body()}</div>
      <button class="go" onClick={() => a.set(a() === "x" ? "z" : "x")}>
        go
      </button>
    </section>
  );
}

/** One Show (the common case): its entry keeps the single-spec encoding. */
export function Single() {
  const n = signal(1);
  const one = () => [<Show when={() => n() > 0}>{() => <b class="only">only</b>}</Show>, <em class="len">{String(n() > 5)}</em>];
  return (
    <section>
      <div class="one">{one()}</div>
      <button class="go" onClick={() => n.set(n() + 1)}>
        go
      </button>
    </section>
  );
}

/** A read steered by a signal outside its Shows (which Shows it creates): no branch is adopted (slots would shift). */
export function Steered() {
  const flag = signal(false);
  const n = signal(1);
  const a = () => <Show when={() => n() > 0}>{() => <b class="a">A</b>}</Show>;
  const body = () => (flag() ? [<Show when={() => n() > 0}>{() => <b class="b">B</b>}</Show>, a()] : [a()]);
  return (
    <section>
      <div class="steer">{body()}</div>
      <button class="go" onClick={() => flag.set(!flag())}>
        go
      </button>
    </section>
  );
}

/** `Mix` with eager props (`each={list()}`, `when={n() >= 1}`): the server resume target passes them as getters, so the
 * runtime For / Show read them inside their hooks — not steering reads of the region (compiler `resume_structural.rs`). */
export function EagerMix() {
  const n = signal(1);
  const list = signal(["a", "b"]);
  const body = () => [
    <Show when={n() >= 1}>{() => <b class="s s1">1</b>}</Show>,
    <For each={list()} by={(x: string) => x}>
      {(x: () => string) => <i class={"row " + x()}>{x()}</i>}
    </For>,
    <Show when={n() >= 2}>{() => <b class="s s2">2</b>}</Show>,
  ];
  return (
    <section>
      <div class="eager">{body()}</div>
      <button class="go" onClick={() => n.set(n() === 1 ? 2 : 1)}>
        go
      </button>
      <button class="add" onClick={() => list.set([...list(), "c"])}>
        add
      </button>
    </section>
  );
}

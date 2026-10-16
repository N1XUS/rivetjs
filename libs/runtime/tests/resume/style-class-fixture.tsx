import { signal } from "@rivetjs/reactivity";

// G10: class: / style: directives, class objects / arrays and style objects on every target.
export function Toggles() {
  const on = signal(true),
    n = signal(1),
    image = signal("none");
  return (
    <main>
      <p
        id="t"
        class="base"
        class:on={on()}
        class:off={!on()}
        style:color={on() ? "red" : "blue"}
        style={{ "--rv-x": n(), marginTop: "1px" }}
        style:background-image={image()}
      >
        t
      </p>
      <button id="flip" onClick={() => (on.set(!on()), n.set(n() + 1))}>flip</button>
      <button id="unsafe" onClick={() => image.set("url(https://evil.test/x.png)")}>unsafe</button>
    </main>
  );
}

export function Objects() {
  const on = signal(false);
  return (
    <main>
      <p id="o" class={{ active: on(), big: true }}>o</p>
      <span id="a" class={["a", on() && "b", ["c", { d: on() }]]}>a</span>
      <i id="m" class={on() ? "x y" : "x"} class:y={!on()} class:z={on()}>m</i>
      <button id="toggle" onClick={() => on.set(!on())}>toggle</button>
    </main>
  );
}

export function Spread() {
  const rest = signal<Record<string, unknown>>({ class: "s1 s2", title: "one" }),
    on = signal(false),
    c = signal("green");
  return (
    <main>
      <div id="sp" {...rest()} class:s2={on()} class:on={on()} style:color={c()}>
        sp
      </div>
      <button id="go" onClick={() => (rest.set({ class: "s3", title: "two" }), on.set(true), c.set("purple"))}>go</button>
    </main>
  );
}

export function Unsafe(props: { value: string }) {
  return (
    <p id="u" style:background={props.value} style={{ color: "red" }}>
      u
    </p>
  );
}

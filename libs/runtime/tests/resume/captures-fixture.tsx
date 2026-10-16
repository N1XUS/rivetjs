// G26 resume captures: functions passed through component props, behavior bags and spreads must
// serialize as symbols when a resumed site captures them.
import { signal } from "@rivetjs/reactivity";

// Its handler captures `props`: every prop must be serializable.
function Menu(props: any) {
  const open = signal(false);
  return (
    <div id={props.id} class={open() ? "menu open" : "menu"}>
      <button
        class="act"
        onClick={() => {
          open.set(true);
          props.onAction(props.label);
        }}
      >
        {props.label}
      </button>
    </div>
  );
}

// K5: fragment root, const arrow passed to a component prop.
function FragmentRoot() {
  const last = signal("");
  const onAction = (k: string) => last.set(k);
  return (
    <>
      <Menu id="k5" label="k5" onAction={onAction} />
      <p id="k5-out">{last()}</p>
    </>
  );
}

// K1: inline callback prop (fragment root and under an element).
function InlineProp() {
  const last = signal("");
  return (
    <>
      <Menu id="k1a" label="k1a" onAction={(k: string) => last.set(k)} />
      <section>
        <Menu id="k1b" label="k1b" onAction={(k: string) => last.set(k + "!")} />
      </section>
      <p id="k1-out">{last()}</p>
    </>
  );
}

// K1: behavior bag returned by a hook, and an inline object prop.
function useCounter(step: number) {
  const n = signal(0);
  return { n, bind: { onClick: () => n.set(n() + step) } };
}
function Pressable(props: any) {
  const presses = signal(0);
  return (
    <button
      id={props.id}
      data-presses={presses()}
      onClick={() => {
        presses.set(presses() + 1);
        props.bag.onClick();
      }}
    >
      press
    </button>
  );
}
function Bags() {
  const c = useCounter(2);
  const m = signal(0);
  return (
    <>
      <Pressable id="k1c" bag={c.bind} />
      <Pressable id="k1d" bag={{ onClick: () => m.set(m() + 10) }} />
      <p id="k1-bag">{c.n() + m()}</p>
    </>
  );
}

// K2: spread handlers from a behavior bag / props; one spread also reads a signal (its binding
// re-binds the handler once activated: it must not run twice).
function SpreadButton(props: any) {
  return <button {...props.attrs}>{props.label}</button>;
}
function Spreads() {
  const c = useCounter(1);
  const n = signal(0);
  return (
    <>
      <SpreadButton label="s1" attrs={{ id: "k2a", ...c.bind }} />
      <button {...{ id: "k2b", "data-n": n(), onClick: () => n.set(n() + 1) }}>s2</button>
      <p id="k2-out">{c.n() + ":" + n()}</p>
    </>
  );
}

// G25: conditional r:slot child and inline conditional function prop; the class binding captures props.
function Card(props: any) {
  const open = signal(false);
  return (
    <div id={props.id} class={(props.header ? "h" : "n") + (open() ? " o" : "")} onClick={() => open.set(!open())}>
      <slot r:name="header" />
      <i>card</i>
    </div>
  );
}
function Conditional({ show }: { show: boolean }) {
  return (
    <>
      <Card id="g25a">{show && <h2 r:slot="header">A</h2>}</Card>
      <Card id="g25b" header={show ? () => <h2>B</h2> : undefined} />
      <Card id="g25c">{show ? null : <h2 r:slot="header">C</h2>}</Card>
    </>
  );
}

export function Page() {
  return (
    <main>
      <FragmentRoot />
      <InlineProp />
      <Bags />
      <Spreads />
      <Conditional show={true} />
    </main>
  );
}

// Context / deep-nesting scenarios (Rivet lane). Same trees as solid.jsx; see README section "Context suite".
import { createContext, useContext, signal } from "@rivetjs/reactivity";
import { Provider, ErrorBoundary } from "@rivetjs/runtime/dom";
import { CONTEXTS, LEAVES, READS, TREE } from "./shape.js";

const Value = createContext(0);
// Every level renders its child from a reactive expression (one binding effect / render effect per level).
const on = signal(true);
const contexts = Array.from({ length: CONTEXTS }, (_, i) => createContext(i));

// deep-N: every level reads the context and renders the next level from a reactive child expression.
function Level(props) {
  const v = useContext(Value),
    d = props.depth;
  return <div data-v={v}>{on() && (d > 0 ? <Level depth={d - 1} /> : <span>{v}</span>)}</div>;
}
function Deep(props) {
  return (
    <Provider token={Value} value={1}>
      <Level depth={props.depth} />
    </Provider>
  );
}

// providers-50: 50 nested providers, then 1000 leaves each reading 10 of them (outermost included).
function Leaf10() {
  let sum = 0;
  for (let i = 0; i < READS; i++) sum += useContext(contexts[(i * CONTEXTS) / READS]);
  return <i>{sum}</i>;
}
function Providers(props) {
  return props.i < CONTEXTS ? (
    <Provider token={contexts[props.i]} value={props.i + 1}>
      <Providers i={props.i + 1} />
    </Provider>
  ) : (
    <p>
      {Array.from({ length: LEAVES }, () => (
        <Leaf10 />
      ))}
    </p>
  );
}

// tree: binary tree (depth TREE); every node re-provides Value (+1) and reads Value and the root context.
function Node(props) {
  const depth = useContext(Value),
    root = useContext(contexts[0]),
    d = props.depth;
  return (
    <Provider token={Value} value={depth + 1}>
      <b data-d={depth + root}>{on() && d > 0 ? [<Node depth={d - 1} />, <Node depth={d - 1} />] : null}</b>
    </Provider>
  );
}
function Tree() {
  return (
    <Provider token={contexts[0]} value={7}>
      <Node depth={TREE} />
    </Provider>
  );
}

// update-1000: a signal in context, 1000 consumers bind it.
const theme = signal(0);
function Consumer() {
  const t = useContext(Value);
  return <u>{t()}</u>;
}
function Update() {
  return (
    <Provider token={Value} value={theme}>
      <p>
        {Array.from({ length: LEAVES }, () => (
          <Consumer />
        ))}
      </p>
    </Provider>
  );
}

// error-1000: an ErrorBoundary above a 1000-deep chain; the leaf's binding throws on update.
const fail = signal(false);
function boom() {
  throw new Error("boom");
}
function Chain(props) {
  const d = props.depth;
  return <div>{on() && (d > 0 ? <Chain depth={d - 1} /> : <span>{fail() ? boom() : "ok"}</span>)}</div>;
}
function Errors(props) {
  return (
    <ErrorBoundary fallback={() => <em>failed</em>}>
      <Chain depth={props.depth} />
    </ErrorBoundary>
  );
}

// themed-N: a theme-like signal read at every level (class) plus one structural read at the leaf (an
// effect that owns content: owner-first flush ordering applies), then toggled.
const tick = signal(0);
function Themed(props) {
  const d = props.depth;
  return <div class={tick() % 2 ? "odd" : "even"}>{on() && (d > 0 ? <Themed depth={d - 1} /> : tick() % 2 ? <Level depth={0} /> : <span>even</span>)}</div>;
}

export const app = {
  themed: (depth) => <Themed depth={depth} />,
  tick: (v) => tick.set(v),
  deep: (depth) => <Deep depth={depth} />,
  providers: () => <Providers i={0} />,
  tree: () => <Tree />,
  update: () => <Update />,
  error: (depth) => <Errors depth={depth} />,
  theme: (v) => theme.set(v),
  fail: (v) => fail.set(v),
};

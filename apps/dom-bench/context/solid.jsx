// Context / deep-nesting scenarios (Solid stable lane). Same trees as rivet.jsx.
import { createContext, useContext, createSignal, ErrorBoundary } from "solid-js";
import { CONTEXTS, LEAVES, READS, TREE } from "./shape.js";

const Value = createContext(0);
const [on] = createSignal(true);
const contexts = Array.from({ length: CONTEXTS }, (_, i) => createContext(i));

function Level(props) {
  const v = useContext(Value),
    d = props.depth;
  return <div data-v={v}>{on() && (d > 0 ? <Level depth={d - 1} /> : <span>{v}</span>)}</div>;
}
function Deep(props) {
  return (
    <Value.Provider value={1}>
      <Level depth={props.depth} />
    </Value.Provider>
  );
}

function Leaf10() {
  let sum = 0;
  for (let i = 0; i < READS; i++) sum += useContext(contexts[(i * CONTEXTS) / READS]);
  return <i>{sum}</i>;
}
function Providers(props) {
  if (props.i >= CONTEXTS)
    return (
      <p>
        {Array.from({ length: LEAVES }, () => (
          <Leaf10 />
        ))}
      </p>
    );
  const C = contexts[props.i];
  return (
    <C.Provider value={props.i + 1}>
      <Providers i={props.i + 1} />
    </C.Provider>
  );
}

function Node(props) {
  const depth = useContext(Value),
    root = useContext(contexts[0]),
    d = props.depth;
  return (
    <Value.Provider value={depth + 1}>
      <b data-d={depth + root}>{on() && d > 0 ? [<Node depth={d - 1} />, <Node depth={d - 1} />] : null}</b>
    </Value.Provider>
  );
}
function Tree() {
  const C = contexts[0];
  return (
    <C.Provider value={7}>
      <Node depth={TREE} />
    </C.Provider>
  );
}

const [theme, setTheme] = createSignal(0);
function Consumer() {
  const t = useContext(Value);
  return <u>{t()}</u>;
}
function Update() {
  return (
    <Value.Provider value={theme}>
      <p>
        {Array.from({ length: LEAVES }, () => (
          <Consumer />
        ))}
      </p>
    </Value.Provider>
  );
}

const [fail, setFail] = createSignal(false);
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
const [tick, setTick] = createSignal(0);
function Themed(props) {
  const d = props.depth;
  return <div class={tick() % 2 ? "odd" : "even"}>{on() && (d > 0 ? <Themed depth={d - 1} /> : tick() % 2 ? <Level depth={0} /> : <span>even</span>)}</div>;
}

export const app = {
  themed: (depth) => <Themed depth={depth} />,
  tick: (v) => setTick(v),
  deep: (depth) => <Deep depth={depth} />,
  providers: () => <Providers i={0} />,
  tree: () => <Tree />,
  update: () => <Update />,
  error: (depth) => <Errors depth={depth} />,
  theme: (v) => setTheme(v),
  fail: (v) => setFail(v),
};

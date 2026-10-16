import { createContext } from "@rivetjs/reactivity";
import { captureAsyncContext } from "../async.js";
import { lazyFunction } from "../lazy.js";
import { Async, lazyComponent, clientOnly } from "../server-async.js";
const context = captureAsyncContext();
const token = createContext("user");
const user: string = context.get(token);
const count: number = context.run(() => 42);
const add = lazyFunction(async () => ({ default: (a: number, b: number) => a + b }));
const sum: Promise<number> = add(1, 2);
const called: Promise<number> = add.invoke([1, 2]);
// @ts-expect-error incorrect application argument type
add("one", 2);
// @ts-expect-error cancellation does not belong to application arguments
add(1, 2, { signal: new AbortController().signal });
const named = lazyFunction(
  () => ({ size: (text: string) => text.length }),
  (module) => module.size,
);
const size: Promise<number> = named("text");
// @ts-expect-error named function arguments remain typed
named(1);
const boundary = (
  <Async
    load={async (work) => {
      const signal: AbortSignal = work.signal;
      return work.get(token);
    }}
    children={(value) => <p>{value.toUpperCase()}</p>}
  />
);
const C = lazyComponent(() => ({ default: (props: { name: string }) => <b>{props.name}</b> }));
const node = <C name="ok" />;
// @ts-expect-error loaded components retain required props
const missing = <C />;
const Only = clientOnly(
  () => ({ default: (props: { name: string }) => document.createElement(props.name) }),
  undefined,
  { fallback: (props) => <i>{props.name}</i> },
);
const client = <Only name="ok" />;
const Later = clientOnly(() => ({ default: (props: { name: string }) => props.name }), undefined, { when: "interaction" });
// @ts-expect-error unknown mount trigger
const BadLater = clientOnly(() => ({ default: (props: { name: string }) => props.name }), undefined, { when: "hover" });

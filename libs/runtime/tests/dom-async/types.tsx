import { Async, lazyComponent, clientOnly, mount } from "@rivetjs/runtime/dom";
import { createContext } from "@rivetjs/reactivity";
const token = createContext("default");
const module = async () => ({ default: (props: { label: string }) => <strong>{props.label}</strong> });
const Lazy = lazyComponent(module, undefined, { fallback: () => <i>pending</i>, error: (cause) => String(cause) });
const Client = clientOnly(module, undefined, { fallback: (props) => <em>{props.label}</em> });
const Named = lazyComponent(
  async () => ({ named: (props: { id: number }) => <b>{props.id}</b> }),
  (m) => m.named,
);
const view = (
  <Async
    load={async (work) => {
      const value = work.get(token);
      await Promise.resolve();
      return work.run(() => value.length);
    }}
    fallback={() => <i>loading</i>}
    error={(cause) => String(cause)}
  >
    {(value) => <span>{value.toFixed()}</span>}
  </Async>
);
mount(
  () => (
    <section>
      {view}
      <Lazy label="ok" />
      <Client label="ok" />
      <Named id={1} />
    </section>
  ),
  document.createElement("div"),
);
// @ts-expect-error selected component requires label
const missing = <Lazy />;
// @ts-expect-error inferred lazy prop remains string
const wrong = <Client label={1} />;
// @ts-expect-error selected named function requires numeric id
const wrongNamed = <Named id="one" />;
// @ts-expect-error async load data remains a number
const badData = <Async load={() => 1}>{(value) => value.missing}</Async>;
// @ts-expect-error ordinary DOM children reject Promise output
mount(() => Promise.resolve("not a boundary"), document.body);
// clientOnly `when`: the resume mount trigger.
const Visible = clientOnly(module, undefined, { when: "idle", fallback: (props) => <em>{props.label}</em> });
const OnMedia = clientOnly(module, undefined, { when: "media:(min-width: 40em)" });
// @ts-expect-error unknown mount trigger
const BadWhen = clientOnly(module, undefined, { when: "hover" });

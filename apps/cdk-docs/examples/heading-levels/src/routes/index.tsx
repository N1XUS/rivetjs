import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { Heading, HeadingContext } from "@rivetjs/cdk/heading";

export const head = { title: "Heading levels" };

// #region demo
export default function HeadingLevels() {
  const step = signal(1);
  return (
    <div class="demo">
      <Heading id="h-default">Default level 3</Heading>
      <Heading id="h-one" level={1}>
        Level 1
      </Heading>
      <Provider token={HeadingContext} value={{ level: 2, class: "section-title" }}>
        <Heading id="h-ctx">From context</Heading>
      </Provider>
      {/* Context children may be an accessor: the heading text follows the signal. */}
      <Provider token={HeadingContext} value={{ level: 4, children: () => "Step " + step() }}>
        <Heading id="h-live" />
      </Provider>
      <button id="h-next" type="button" onClick={() => step.set(step() + 1)}>
        Next step
      </button>
    </div>
  );
}
// #endregion

import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { Provider } from "@rivetjs/cdk/slots";
import { Heading, HeadingContext } from "@rivetjs/cdk/heading";
import { Text, TextContext } from "@rivetjs/cdk/text";

export const head = { title: "Slots: Provider" };

// #region demo
/** A container that provides props to its parts, like RAC Dialog / Field components do. */
function Card(props: { id: string; children?: Content }) {
  const id = props.id;
  const children = props.children;
  return (
    <article id={id} class="card" aria-labelledby={id + "-title"} aria-describedby={id + "-desc"}>
      <Provider
        values={[
          [HeadingContext, { id: id + "-title", level: 2, class: "card-title" }],
          [TextContext, { slots: { description: { id: id + "-desc" }, note: { id: id + "-note", class: "card-note" } } }],
        ]}
      >
        {children}
      </Provider>
    </article>
  );
}

export default function SlotsProvider() {
  return (
    <div class="demo">
      <Card id="card">
        <Heading>Walnut desk</Heading>
        <Text slot="description">Ships in 2 days</Text>
        <Text slot="note" elementType="p">
          Assembly required.
        </Text>
      </Card>
    </div>
  );
}
// #endregion

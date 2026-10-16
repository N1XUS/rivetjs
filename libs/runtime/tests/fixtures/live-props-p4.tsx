// Lane LIVE-PROPS P4 fixture (`../live-props-p4.test.ts`): native-element spreads of an identifier holding live props.
import { splitProps } from "@rivetjs/runtime/props";

/** A lone identifier spread of a `splitProps` rest (ui radix Avatar `<span {...rest}>`). */
export function Lone(props: Record<string, unknown>) {
  const [, rest] = splitProps(props, ["tone"]);
  return <span {...rest} />;
}
/** The component's own props object spread as is. */
export const Own = (props: Record<string, unknown>) => <i {...props} />;
/** An identifier spread next to a static attribute. */
export function Mixed(props: Record<string, unknown>) {
  const [, rest] = splitProps(props, ["tone"]);
  return <b data-x="1" {...rest} />;
}
/** Call sites with a dynamic prop (compiled live props: a getter). */
export const Uses = (props: { title: () => string }) => (
  <div>
    <Lone title={props.title()} tone="t" />
    <Own title={props.title()} />
    <Mixed title={props.title()} tone="t" />
  </div>
);

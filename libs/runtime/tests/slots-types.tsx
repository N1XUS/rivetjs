// Type tests for slots (checked by slots-types.test.ts with strict tsc).
import type { Content, Slot, Slots } from "../jsx-runtime.ts";

interface CardProps extends Slots<"header" | "footer"> {
  row: Slot<[item: () => string, index: () => number]>;
  children?: Content;
}
function Card({ header, footer, row, children }: CardProps) {
  const item = () => "a";
  const index = () => 0;
  return (
    <article>
      <slot r:name="header">Untitled</slot>
      <slot />
      <slot r:name="row" r:args={[item, index]} />
      <slot r:name="footer" />
      {header}
      {children}
      {footer}
      {row(item, index)}
    </article>
  );
}

export const ok = (
  <Card row={(item, index) => <li>{index()}:{item().toUpperCase()}</li>}>
    <h2 r:slot="header">Title</h2>
    body
    <Card r:slot="footer" row={() => <i />} />
  </Card>
);
export const lazyDefault = <Card row={() => <i />}>{() => <p>lazy</p>}</Card>;
export const valueSlot = <Card row={() => <i />} header={<h2>eager</h2>} footer={() => <small />} />;

// @ts-expect-error a required slot is missing
export const missing = <Card />;
// @ts-expect-error slot arguments are typed
export const wrongArgs = <Card row={(item: number) => <li>{item}</li>} />;
// @ts-expect-error a scoped slot must be a function
export const valueForScoped = <Card row={<li />} />;
// @ts-expect-error r:slot names are strings
export const badName = <Card row={() => <i />}><b r:slot={1} /></Card>;
// @ts-expect-error r:args is a list
export const badArgs = <slot r:args={1} />;

// Slot presence: a `Slots` prop is optional, so a plain truthiness check types (no helper needed).
function Framed(props: Slots<"header"> & { children?: Content }) {
  const framed: boolean = !!props.header;
  return (
    <div class={props.header ? "card has-header" : "card"} data-framed={framed}>
      <slot r:name="header" />
      <slot />
    </div>
  );
}
function FramedDestructured({ header, children }: Slots<"header"> & { children?: Content }) {
  return <div class={header ? "card has-header" : "card"}>{children}</div>;
}
export const framed = (
  <Framed>
    <h2 r:slot="header">Title</h2>
  </Framed>
);
export const unframed = <FramedDestructured>body</FramedDestructured>;

// Ported from Angular Components (src/cdk/drag-drop/directives/drop-list-group.ts), MIT, © Google LLC.
// Rivet: `cdkDropListGroup` as a component rendering its element (`elementType`, default `div`) with
// `data-rv-drop-list-group` (+ `rv-DropListGroup` when `class` is omitted); `disabled`
// (`cdkDropListGroupDisabled`) renders `data-disabled`. The group instance is derived from the DOM
// (directives/drop-list-group.ts): no code ships for it.
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import type { StyleObject } from "@rivetjs/runtime/style";
import { hostDOMProps, type GlobalDOMAttributes, type HostDOMAttributes } from "@rivetjs/cdk/dom-props";
import { read, type MaybeAccessor } from "./directives/registry.ts";

export interface DropListGroupProps extends GlobalDOMAttributes<HTMLElement>, HostDOMAttributes<HTMLElement> {
  /** Whether starting a dragging sequence from inside this group is disabled. */
  disabled?: MaybeAccessor<boolean | undefined>;
  /** Element to render. @default "div" */
  elementType?: "div" | "section";
  id?: string;
  /** @default "rv-DropListGroup" */
  class?: string;
  /** Inline style of the element. */
  style?: StyleObject;
  children?: Content;
}

/**
 * Declaratively connects sibling `DropList` instances together. All of the `DropList`
 * elements that are placed inside a `DropListGroup` will be connected to each other
 * automatically. Can be used as an alternative to the `connectedTo` input of `DropList`.
 */
export function DropListGroup(props: DropListGroupProps) {
  const dom = hostDOMProps(props);
  const { id, elementType, style, children } = props;
  const disabled = props.disabled;
  const className = props.class ?? "rv-DropListGroup";
  const isDisabled = () => !!read(disabled);
  return elementType === "section" ? (
    <section {...dom} id={id} class={className} data-rv-drop-list-group="" style={style} data-disabled={isDisabled() ? "true" : undefined}>
      {children}
    </section>
  ) : (
    <div {...dom} id={id} class={className} data-rv-drop-list-group="" style={style} data-disabled={isDisabled() ? "true" : undefined}>
      {children}
    </div>
  );
}

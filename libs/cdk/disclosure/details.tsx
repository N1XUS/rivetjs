// Rivet component (no upstream): a disclosure on the native <details>/<summary> elements — zero
// JavaScript (keyboard, find-in-page opens matches, screen readers expose the expanded state). Disclosures
// sharing `group` form an exclusive accordion (native `name`). The RAC-faithful `Disclosure` (button +
// panel parts, controlled state, DisclosureGroup) lives in ./index.tsx.
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";

/** Global DOM events / attributes go on the `<details>` root. */
export interface DetailsDisclosureProps extends GlobalDOMAttributes<HTMLDetailsElement> {
  /** The `<summary>` content. */
  title: Content;
  /** Whether the disclosure starts open. */
  defaultExpanded?: boolean;
  /** Exclusive accordion: at most one open disclosure per group name (native `name`). */
  group?: string;
  id?: string;
  /** @default 'rv-DetailsDisclosure' */
  class?: string;
  /** @default 'rv-DetailsDisclosure-summary' */
  summaryClass?: string;
  /** @default 'rv-DetailsDisclosure-panel' */
  panelClass?: string;
  children?: Content;
}

/** A disclosure on native `<details>` (no JavaScript). */
export function DetailsDisclosure(props: DetailsDisclosureProps) {
  const dom = globalDOMProps(props);
  const idProp = props.id;
  const className = props.class;
  const group = props.group;
  const defaultExpanded = props.defaultExpanded;
  const summaryClass = props.summaryClass ?? "rv-DetailsDisclosure-summary",
    panelClass = props.panelClass ?? "rv-DetailsDisclosure-panel";
  return (
    <details {...dom} id={idProp} class={className ?? "rv-DetailsDisclosure"} name={group} open={defaultExpanded}>
      <summary class={summaryClass}>{props.title}</summary>
      <div class={panelClass}>{props.children}</div>
    </details>
  );
}

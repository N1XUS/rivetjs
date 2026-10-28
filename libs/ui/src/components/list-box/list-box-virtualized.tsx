// Rivet addition: opt-in collection virtualization, kept out of the ordinary ListBox import graph.
import { ListBox as ListBoxPrimitive } from "@rivetjs/cdk/listbox";
import type { ListBoxProps } from "@rivetjs/cdk/listbox";
import { CollectionVirtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { splitLive } from "../../utils/live.tsx";

// `composed`: the composed class, under a non-class name so the class-override scan (`libs/compiler/class-merge.ts`) does not
// read this hand-off as a resolver override.
type Props = Omit<ListBoxProps<object>, "class"> & {
  composed?: ListBoxProps<object>["class"];
  rowHeight?: number;
  initialSize?: { width: number; height: number };
};

export default function VirtualizedListBox(props: Props): JSX.Element {
  const [local, rest] = splitLive(props, ["rowHeight", "initialSize", "composed"]);
  // Build the list inside the provider so it reads the collection renderer context.
  return (
    <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowSize: local.rowHeight ?? 36 }} initialSize={local.initialSize}>
      <ListBoxPrimitive data-slot="list-box" data-ui-virtualized="true" {...rest} class={local.composed as never} />
    </CollectionVirtualizer>
  );
}

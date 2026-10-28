// Rivet addition: loaded only for the Table virtualization opt-in.
import { Table as TablePrimitive } from "@rivetjs/cdk/table";
import { CollectionVirtualizer, TableLayout } from "@rivetjs/cdk/virtualizer";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import type { TableContentProps } from "./table.tsx";
import { splitLive } from "../../utils/live.tsx";

// `composed`: the composed class, under a non-class name so the class-override scan (`libs/compiler/class-merge.ts`) does not
// read this hand-off as a resolver override.
export default function VirtualizedTable(props: Omit<TableContentProps, "virtualized" | "class"> & { composed?: TableContentProps["class"] }): JSX.Element {
  const [local, rest] = splitLive(props, ["rowHeight", "headingHeight", "initialSize", "style", "composed"]);
  // Construct the grid inside the provider: Rivet JSX is eager on the client.
  return (
    <CollectionVirtualizer
      layout={TableLayout}
      layoutOptions={{ rowHeight: local.rowHeight ?? 48, headingHeight: local.headingHeight ?? 48 }}
      initialSize={local.initialSize}
    >
      <TablePrimitive
        data-slot="table-content"
        data-ui-virtualized="true"
        {...rest}
        class={local.composed as never}
        style={(values) => ({
          width: `${local.initialSize?.width ?? 800}px`,
          height: `${local.initialSize?.height ?? 600}px`,
          overflow: "auto",
          ...(typeof local.style === "function" ? local.style(values) : local.style),
        })}
      />
    </CollectionVirtualizer>
  );
}

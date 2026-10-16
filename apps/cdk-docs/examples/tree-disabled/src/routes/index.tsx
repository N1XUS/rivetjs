import { ChevronRight } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import type { DisabledBehavior } from "@rivetjs/cdk/collections/types";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tree: disabled rows" };

// #region demo
function Row(props: { label: string }) {
  return (
    <TreeItemContent>
      {({ hasChildItems, isExpanded }) => (
        <div class="flex items-center gap-1.5" style={{ "padding-inline-start": "calc((var(--tree-item-level) - 1) * 1.25rem)" }}>
          {hasChildItems() ? (
            <Button slot="chevron" class="grid size-5 place-items-center rounded text-slate-500">
              <Icon icon={ChevronRight} size={14} class={isExpanded() ? "rotate-90" : ""} />
            </Button>
          ) : (
            <span class="size-5" />
          )}
          {props.label}
        </div>
      )}
    </TreeItemContent>
  );
}

const row =
  "rounded px-1 py-0.5 outline-none data-[selected]:bg-sky-100 data-[disabled]:text-slate-400 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500";

function Files(props: { id: string; behavior: DisabledBehavior }) {
  return (
    <Tree
      id={props.id}
      aria-label={`Files (disabledBehavior ${props.behavior})`}
      selectionMode="multiple"
      disabledKeys={["photos"]}
      disabledBehavior={props.behavior}
      class="rounded-lg border border-slate-200 p-1 outline-none"
    >
      <TreeItem id="documents" textValue="Documents" class={row}>
        <Row label="Documents" />
      </TreeItem>
      <TreeItem id="photos" textValue="Photos" class={row}>
        <Row label="Photos" />
        <TreeItem id="beach" textValue="Beach" class={row}>
          <Row label="Beach" />
        </TreeItem>
      </TreeItem>
      <TreeItem id="music" textValue="Music" class={row}>
        <Row label="Music" />
      </TreeItem>
      {/* isDisabled on the item works like disabledKeys. */}
      <TreeItem id="trash" textValue="Trash" isDisabled class={row}>
        <Row label="Trash" />
      </TreeItem>
    </Tree>
  );
}

export default function Disabled() {
  return (
    <section class="m-4 grid grid-cols-2 gap-4 text-sm">
      <div class="grid content-start gap-1">
        <span class="font-semibold">disabledBehavior="all"</span>
        <Files id="all" behavior="all" />
      </div>
      <div class="grid content-start gap-1">
        <span class="font-semibold">disabledBehavior="selection"</span>
        <Files id="sel" behavior="selection" />
      </div>
    </section>
  );
}
// #endregion

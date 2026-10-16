import { signal } from "@rivetjs/reactivity";
import { ChevronRight } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import type { Key, Selection } from "@rivetjs/cdk/collections/types";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tree: selection and actions" };

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
  "rounded px-1 py-0.5 outline-none data-[selected]:bg-sky-600 data-[selected]:text-white data-[disabled]:text-slate-400 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500";

export default function Evolutions() {
  const selected = signal<Selection>(new Set<Key>());
  const action = signal("none");
  return (
    <section class="m-4 grid max-w-xs gap-2 text-sm">
      <Tree
        id="evolutions"
        aria-label="Pokemon evolution"
        selectionMode="single"
        selectionBehavior="replace"
        selectedKeys={selected}
        onAction={(key) => action.set(String(key))}
        defaultExpandedKeys={["bulbasaur", "ivysaur"]}
        class="rounded-lg border border-slate-200 p-1 outline-none"
      >
        <TreeItem id="bulbasaur" textValue="Bulbasaur" class={row}>
          <Row label="Bulbasaur" />
          <TreeItem id="ivysaur" textValue="Ivysaur" class={row}>
            <Row label="Ivysaur" />
            <TreeItem id="venusaur" textValue="Venusaur" isDisabled class={row}>
              <Row label="Venusaur" />
            </TreeItem>
          </TreeItem>
        </TreeItem>
        <TreeItem id="charmander" textValue="Charmander" class={row}>
          <Row label="Charmander" />
          <TreeItem id="charmeleon" textValue="Charmeleon" class={row}>
            <Row label="Charmeleon" />
          </TreeItem>
        </TreeItem>
        <TreeItem id="squirtle" textValue="Squirtle" class={row}>
          <Row label="Squirtle" />
        </TreeItem>
      </Tree>
      <output id="evolutions-selection">Selection: {selected() === "all" ? "all" : [...(selected() as Set<Key>)].join(", ") || "none"}</output>
      <output id="evolutions-action">Action: {action()}</output>
    </section>
  );
}
// #endregion

import { computed, signal } from "@rivetjs/reactivity";
import { ChevronRight } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Collection } from "@rivetjs/cdk/collections/components";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tree: dynamic items" };

interface Team {
  id: string;
  name: string;
  children?: Team[];
}

const teams: Team[] = [
  {
    id: "engineering",
    name: "Engineering",
    children: [
      { id: "web", name: "Web" },
      { id: "mobile", name: "Mobile" },
    ],
  },
  { id: "design", name: "Design", children: [{ id: "brand", name: "Brand" }] },
];

// #region demo
/** One row per team, then its child teams through a nested Collection (the row renders itself recursively). */
function TeamItem(props: { team: Team }) {
  const team = props.team;
  return (
    <TreeItem
      id={team.id}
      textValue={team.name}
      class="rounded px-1 py-0.5 outline-none data-[disabled]:text-slate-400 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500"
    >
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
            {team.name}
          </div>
        )}
      </TreeItemContent>
      <Collection items={team.children}>{(child: Team) => <TeamItem team={child} />}</Collection>
    </TreeItem>
  );
}

export default function Org() {
  const visible = signal(true);
  const items = computed(() => (visible() ? teams : []));
  return (
    <section class="m-4 grid max-w-xs gap-2 text-sm">
      <Tree
        id="org"
        aria-label="Teams"
        items={items}
        defaultExpandedKeys={["engineering"]}
        disabledKeys={["mobile"]}
        renderEmptyState={() => <p class="p-2 text-slate-500">No teams</p>}
        class="rounded-lg border border-slate-200 p-1 outline-none"
      >
        {(team: Team) => <TeamItem team={team} />}
      </Tree>
      <button id="hide-all" class="justify-self-start rounded border border-slate-300 px-2 py-0.5" onClick={() => visible.update((_visible) => !_visible)}>
        Toggle teams
      </button>
    </section>
  );
}
// #endregion

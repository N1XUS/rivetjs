import { computed, signal } from "@rivetjs/reactivity";
import { Breadcrumb, Breadcrumbs, type BreadcrumbsOverflowItem, type Key } from "@rivetjs/cdk/breadcrumbs";
import { Button } from "@rivetjs/cdk/button";
import { Link } from "@rivetjs/cdk/link";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";
import { Popover } from "@rivetjs/cdk/popover";
import { Icon } from "@rivetjs/kit/icon";
import { Ellipsis } from "lucide";

export const head = { title: "Breadcrumbs overflow" };

const all = [
  { id: "root", label: "Files" },
  { id: "photos", label: "Photos" },
  { id: "2026", label: "2026" },
  { id: "trips", label: "Trips" },
  { id: "lisbon", label: "Lisbon" },
  { id: "day-3", label: "Day 3 — Alfama" },
];

// #region demo
export default function FolderTrail() {
  const depth = signal(all.length);
  // A computed (not an inline arrow) so the trail stays live on the resumed page.
  const folders = computed(() => all.slice(0, depth()));
  const open = (key: Key) => depth.set(all.findIndex((folder) => folder.id === key) + 1);
  return (
    <div class="m-4 w-[320px] max-w-full resize-x overflow-hidden rounded-lg border border-slate-300 p-3 text-sm">
      <Breadcrumbs
        id="folder-trail"
        aria-label="Folder"
        items={folders}
        onAction={open}
        overflowMode="collapse"
        showRoot
        renderOverflow={(hidden) => (
          <MenuTrigger>
            <Button aria-label="More folders" class="grid size-6 place-items-center rounded hover:bg-slate-100">
              <Icon icon={Ellipsis} size={16} />
            </Button>
            <Popover placement="bottom start">
              <Menu id="folder-menu" items={hidden} onAction={open} class="min-w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                {(item: BreadcrumbsOverflowItem) => (
                  <MenuItem id={item.key} textValue={item.textValue} class="cursor-default rounded px-2 py-1 focused:bg-slate-100">
                    {item.textValue}
                  </MenuItem>
                )}
              </Menu>
            </Popover>
          </MenuTrigger>
        )}
      >
        {(folder: (typeof all)[number]) => (
          <Breadcrumb>
            <Link class="rounded px-0.5 hover:underline">{folder.label}</Link>
          </Breadcrumb>
        )}
      </Breadcrumbs>
    </div>
  );
}
// #endregion

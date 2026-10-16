import { computed, signal } from "@rivetjs/reactivity";
import { Breadcrumb, Breadcrumbs, type Key } from "@rivetjs/cdk/breadcrumbs";
import { Link } from "@rivetjs/cdk/link";

export const head = { title: "Breadcrumbs onAction" };

const all = [
  { id: "root", label: "Files" },
  { id: "photos", label: "Photos" },
  { id: "2026", label: "2026" },
];

// #region demo
export default function Folders() {
  const depth = signal(all.length);
  const log = signal("");
  // A computed (not an inline arrow) so the trail stays live on the resumed page.
  const visible = computed(() => all.slice(0, depth()));
  const onAction = (key: Key) => {
    log.set("action:" + String(key));
    depth.set(all.findIndex((folder) => folder.id === key) + 1);
  };
  return (
    <section class="m-4 grid gap-3 text-sm">
      <Breadcrumbs id="folders" aria-label="Folder" items={visible} onAction={onAction}>
        {(folder: (typeof all)[number]) => (
          <Breadcrumb>
            <Link>{folder.label}</Link>
          </Breadcrumb>
        )}
      </Breadcrumbs>
      <output id="bc-log" class="font-mono text-xs text-slate-600">
        {log()}
      </output>
    </section>
  );
}
// #endregion

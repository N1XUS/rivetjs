import { signal } from "@rivetjs/reactivity";
import { ListBox, ListBoxItem, type Key, type Selection } from "@rivetjs/cdk/listbox";

export const head = { title: "ListBox links" };

// Items with href render as <a role="option">.
const pages: { key: string; label: string; href: string; target?: string }[] = [
  { key: "intro", label: "Introduction", href: "#intro" },
  { key: "install", label: "Installation", href: "#install" },
  { key: "api", label: "API reference", href: "#api", target: "_self" },
];

// #region demo
export default function Pages() {
  const picked = signal<Selection>(new Set<Key>());
  return (
    <section class="m-4 grid grid-cols-2 gap-4 text-sm">
      <div class="grid content-start gap-1">
        <span class="font-semibold">selectionMode="none"</span>
        <ListBox id="nav" aria-label="Pages" items={pages} selectionMode="none">
          {(page: (typeof pages)[number]) => (
            <ListBoxItem id={page.key} href={page.href} target={page.target}>
              {page.label}
            </ListBoxItem>
          )}
        </ListBox>
      </div>
      <div class="grid content-start gap-1">
        <span class="font-semibold">replace: links are actions</span>
        <ListBox id="pick" aria-label="Pages to export" items={pages} selectionMode="multiple" selectionBehavior="replace" selectedKeys={picked}>
          {(page: (typeof pages)[number]) => (
            <ListBoxItem id={page.key} href={page.href} target={page.target}>
              {page.label}
            </ListBoxItem>
          )}
        </ListBox>
        <p id="pick-value" class="text-slate-600">
          Selected: {[...(picked() as Set<Key>)].join(", ") || "none"}
        </p>
      </div>
    </section>
  );
}
// #endregion

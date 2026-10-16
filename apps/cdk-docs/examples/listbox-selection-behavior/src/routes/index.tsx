import { signal } from "@rivetjs/reactivity";
import { ListBox, type Key, type Selection } from "@rivetjs/cdk/listbox";

export const head = { title: "ListBox selectionBehavior" };

const files = [
  { key: "notes", label: "notes.md" },
  { key: "photo", label: "photo.jpg" },
  { key: "report", label: "report.pdf" },
  { key: "slides", label: "slides.key" },
];

const show = (keys: Selection) => (keys === "all" ? "all" : [...keys].map(String).sort().join(", ") || "none");

// #region demo
export default function Files() {
  const toggle = signal<Selection>(new Set<Key>());
  const replace = signal<Selection>(new Set<Key>());
  const opened = signal("none");
  // A local constant: the browser resumes it as the action handler.
  const open = (key: Key) => opened.set(String(key));
  return (
    <section class="m-4 grid grid-cols-2 gap-4 text-sm">
      <div class="grid content-start gap-1">
        <span class="font-semibold">toggle (default)</span>
        <ListBox id="toggle" aria-label="Files (toggle)" items={files} selectionMode="multiple" selectedKeys={toggle} />
        <p id="toggle-value" class="text-slate-600">
          {show(toggle())}
        </p>
      </div>
      <div class="grid content-start gap-1">
        <span class="font-semibold">replace + onAction</span>
        <ListBox
          id="replace"
          aria-label="Files (replace)"
          items={files}
          selectionMode="multiple"
          selectionBehavior="replace"
          selectedKeys={replace}
          onAction={open}
        />
        <p id="replace-value" class="text-slate-600">
          {show(replace())}
        </p>
        <p id="opened" class="text-slate-600">
          Opened: {opened()}
        </p>
      </div>
    </section>
  );
}
// #endregion

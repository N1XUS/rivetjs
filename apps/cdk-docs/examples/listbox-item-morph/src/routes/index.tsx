import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";
import { ItemMorphPanel, closeItemMorph, createItemMorph, itemMorphProps } from "@rivetjs/cdk/morph/item";

export const head = { title: "ListBox item morph" };

const files = [
  { key: "report", name: "report.pdf", size: "2.4 MB", kind: "PDF document" },
  { key: "photo", name: "photo.jpg", size: "640 KB", kind: "JPEG image" },
  { key: "notes", name: "notes.md", size: "3 KB", kind: "Markdown" },
];

// #region demo
export default function ItemMorphDemo() {
  // One morph per list: long press (default) or right click; Shift+F10 / ContextMenu from the keyboard.
  const preview = createItemMorph({ trigger: ["longPress", "contextMenu"] });
  const file = (key: unknown) => files.find((f) => f.key === key);
  return (
    <section class="m-4 w-64">
      <ListBox id="files" aria-label="Files" selectionMode="single" class="rv-ListBox rounded-xl border border-slate-200 p-1">
        <ListBoxItem id="report" textValue="report.pdf" {...itemMorphProps(preview)}>
          report.pdf
        </ListBoxItem>
        <ListBoxItem id="photo" textValue="photo.jpg" {...itemMorphProps(preview)}>
          photo.jpg
        </ListBoxItem>
        <ListBoxItem id="notes" textValue="notes.md" {...itemMorphProps(preview)}>
          notes.md
        </ListBoxItem>
      </ListBox>
      <ItemMorphPanel morph={preview} class="preview" panelClass="preview-panel w-72 p-4 flex flex-col gap-2" backdropClass="preview-backdrop">
        {(key) => (
          <>
            <strong>{() => file(key())?.name}</strong>
            <span class="text-sm text-slate-600">{() => `${file(key())?.kind} · ${file(key())?.size}`}</span>
            <button
              id="preview-close"
              type="button"
              class="self-end rounded-lg bg-slate-900 px-3 py-1 text-sm text-white"
              onClick={() => closeItemMorph(preview)}
            >
              Close
            </button>
          </>
        )}
      </ItemMorphPanel>
    </section>
  );
}
// #endregion

import { signal, type Signal } from "@rivetjs/reactivity";
import { Input } from "@rivetjs/cdk/input";
import { TextField } from "@rivetjs/cdk/text-field";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";

export const head = { title: "Tree: tab navigation" };

// #region demo
/** A row whose content is an editable name (render-function child: the field renders in the row, not in the collection pass). */
function NameRow(props: { id: string; name: string; edited: Signal<string> }) {
  const edited = props.edited;
  return (
    <TreeItemContent>
      {() => (
        <div style={{ "padding-inline-start": "calc((var(--tree-item-level) - 1) * 1.25rem)" }}>
          <TextField aria-label="Name" defaultValue={props.name} onChange={(value: string) => edited.set(value)}>
            <Input id={props.id} class="w-full rounded border border-slate-300 px-2 py-0.5" placeholder="Enter name" />
          </TextField>
        </div>
      )}
    </TreeItemContent>
  );
}

const row = "rounded p-1 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500";

export default function Shared() {
  const edited = signal("");
  return (
    <section class="m-4 grid w-80 gap-2 text-sm">
      <Tree
        id="shared"
        aria-label="Shared files"
        keyboardNavigationBehavior="tab"
        selectionMode="multiple"
        defaultExpandedKeys={["documents", "photos"]}
        class="grid gap-1 rounded-lg border border-slate-200 p-1 text-sm outline-none"
      >
        <TreeItem id="documents" textValue="Documents" class={row}>
          <NameRow id="shared-documents-name" edited={edited} name="Documents" />
          <TreeItem id="weekly" textValue="Weekly Report.pdf" class={row}>
            <NameRow id="shared-weekly-name" edited={edited} name="Weekly Report.pdf" />
          </TreeItem>
          <TreeItem id="budget" textValue="Budget.xlsx" class={row}>
            <NameRow id="shared-budget-name" edited={edited} name="Budget.xlsx" />
          </TreeItem>
        </TreeItem>
        <TreeItem id="photos" textValue="Photos" class={row}>
          <NameRow id="shared-photos-name" edited={edited} name="Photos" />
          <TreeItem id="sunset" textValue="Sunset.jpg" class={row}>
            <NameRow id="shared-sunset-name" edited={edited} name="Sunset.jpg" />
          </TreeItem>
        </TreeItem>
      </Tree>
      <output id="shared-edited">Edited: {edited() || "nothing"}</output>
    </section>
  );
}
// #endregion

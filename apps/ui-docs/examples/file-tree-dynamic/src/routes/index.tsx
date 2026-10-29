// Rivet-authored FileTree demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Collection } from "@rivetjs/cdk/collections/components";
import { FileTree } from "@rivetjs/ui/file-tree";
import { File, Folder } from "lucide";

export const head = { title: "FileTree: Dynamic Collection" };

// #region demo
interface Entry {
  id: string;
  name: string;
  children?: Entry[];
}

const ENTRIES: Entry[] = [
  {
    id: "app",
    name: "app",
    children: [
      {
        id: "routes",
        name: "routes",
        children: [
          { id: "home", name: "index.tsx" },
          { id: "about", name: "about.tsx" },
        ],
      },
      { id: "styles", name: "styles.css" },
    ],
  },
  { id: "public", name: "public", children: [{ id: "logo", name: "logo.svg" }] },
  { id: "config", name: "vite.config.ts" },
];

function EntryItem(props: { entry: Entry }) {
  const entry = props.entry;
  return (
    <FileTree.Item id={entry.id} title={entry.name} icon={<Icon icon={entry.children ? Folder : File} size={16} />}>
      <Collection items={entry.children}>{(child: Entry) => <EntryItem entry={child} />}</Collection>
    </FileTree.Item>
  );
}

export function Dynamic() {
  return (
    <div id="ft-dynamic" class="w-full max-w-xs">
      <FileTree aria-label="Project" items={ENTRIES} defaultExpandedKeys={["app", "routes"]}>
        {(entry: Entry) => <EntryItem entry={entry} />}
      </FileTree>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Dynamic />
    </div>
  );
}

// Rivet-authored FileTree demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import type { Selection } from "@rivetjs/cdk/collections/types";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { FileTree } from "@rivetjs/ui/file-tree";
import { File, Folder } from "lucide";

export const head = { title: "FileTree: Multiple Selection" };

// #region demo
const folder = () => <Icon icon={Folder} size={16} />;
const file = () => <Icon icon={File} size={16} />;

export function MultipleSelection() {
  const selected = signal<Selection>(new Set(["index"]));
  const names = () => {
    const keys = selected();
    return keys === "all" ? "All files" : [...keys].join(", ") || "Nothing";
  };
  return (
    <div id="ft-select" class="w-full max-w-xs flex flex-col gap-3">
      <FileTree aria-label="Project" defaultExpandedKeys={["src", "components"]} selectionMode="multiple" selectedKeys={selected}>
        <FileTree.Item id="src" title="src" icon={folder()}>
          <FileTree.Item id="components" title="components" icon={folder()}>
            <FileTree.Item id="button" title="button.tsx" icon={file()} />
            <FileTree.Item id="card" title="card.tsx" icon={file()} />
          </FileTree.Item>
          <FileTree.Item id="index" title="index.ts" icon={file()} />
        </FileTree.Item>
        <FileTree.Item id="package" title="package.json" icon={file()} />
        <FileTree.Item id="readme" title="README.md" icon={file()} />
      </FileTree>
      <p id="ft-select-names" class="text-sm text-muted">
        Selected: {names()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <MultipleSelection />
    </div>
  );
}

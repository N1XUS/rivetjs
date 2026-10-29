// Rivet-authored FileTree demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { FileTree } from "@rivetjs/ui/file-tree";
import { File, Folder } from "lucide";

export const head = { title: "FileTree: Usage" };

// #region demo
const folder = () => <Icon icon={Folder} size={16} />;
const file = () => <Icon icon={File} size={16} />;

export function Basic() {
  return (
    <div id="ft-basic" class="w-full max-w-xs">
      <FileTree aria-label="Project" defaultExpandedKeys={["src", "components"]}>
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
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}

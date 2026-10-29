// Rivet-authored FileTree demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { FileTree } from "@rivetjs/ui/file-tree";
import type { TreeItemContentRenderProps } from "@rivetjs/cdk/tree";
import { File, Folder, FolderOpen, Minus, Plus } from "lucide";

export const head = { title: "FileTree: Custom Indicator" };

// #region demo
const toggle = (v: TreeItemContentRenderProps) => <span class="grid">{v.isExpanded() ? <Icon icon={Minus} size={14} /> : <Icon icon={Plus} size={14} />}</span>;
const folder = (v: TreeItemContentRenderProps) => (
  <span class="grid">{v.isExpanded() ? <Icon icon={FolderOpen} size={16} /> : <Icon icon={Folder} size={16} />}</span>
);
const file = () => <Icon icon={File} size={16} />;

export function CustomIndicator() {
  return (
    <div id="ft-indicator" class="w-full max-w-xs">
      <FileTree aria-label="Project" defaultExpandedKeys={["src"]}>
        <FileTree.Item id="src" title="src" icon={folder} indicator={toggle}>
          <FileTree.Item id="lib" title="lib" icon={folder} indicator={toggle}>
            <FileTree.Item id="utils" title="utils.ts" icon={file()} />
          </FileTree.Item>
          <FileTree.Item id="main" title="main.ts" icon={file()} />
        </FileTree.Item>
      </FileTree>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CustomIndicator />
    </div>
  );
}

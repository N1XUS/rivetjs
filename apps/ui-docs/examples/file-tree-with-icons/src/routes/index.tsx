// Rivet-authored FileTree demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import type { TreeItemContentRenderProps } from "@rivetjs/cdk/tree";
import { Icon } from "@rivetjs/kit/icon";
import { FileTree } from "@rivetjs/ui/file-tree";
import { FileCode, FileJson, FileText, Folder, FolderOpen, Image } from "lucide";

export const head = { title: "FileTree: With Icons" };

// #region demo
// A function icon gets the row's render props: folders switch to an open folder while expanded.
const folder = (v: TreeItemContentRenderProps) => (
  <span class="grid text-accent">{v.isExpanded() ? <Icon icon={FolderOpen} size={16} /> : <Icon icon={Folder} size={16} />}</span>
);
const code = () => <Icon icon={FileCode} size={16} />;
const json = () => <Icon icon={FileJson} size={16} />;
const text = () => <Icon icon={FileText} size={16} />;
const image = () => <Icon icon={Image} size={16} />;

export function WithIcons() {
  return (
    <div id="ft-with-icons" class="w-full max-w-xs">
      <FileTree aria-label="Website" defaultExpandedKeys={["src"]}>
        <FileTree.Item id="src" title="src" icon={folder}>
          <FileTree.Item id="main" title="main.tsx" icon={code()} />
          <FileTree.Item id="assets" title="assets" icon={folder}>
            <FileTree.Item id="logo" title="logo.svg" icon={image()} />
            <FileTree.Item id="hero" title="hero.jpg" icon={image()} />
          </FileTree.Item>
        </FileTree.Item>
        <FileTree.Item id="package" title="package.json" icon={json()} />
        <FileTree.Item id="readme" title="README.md" icon={text()} />
      </FileTree>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithIcons />
    </div>
  );
}

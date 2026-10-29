// Rivet-authored FileTree demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { FileTree } from "@rivetjs/ui/file-tree";
import { File, Folder } from "lucide";

export const head = { title: "FileTree: Reduced Motion" };

// #region demo
const folder = () => <Icon icon={Folder} size={16} />;
const file = () => <Icon icon={File} size={16} />;

export function ReducedMotion() {
  return (
    <div id="ft-reduced-motion" class="w-full max-w-xs">
      <FileTree aria-label="Project" reduceMotion defaultExpandedKeys={["app"]}>
        <FileTree.Item id="app" title="app" icon={folder()}>
          <FileTree.Item id="routes" title="routes" icon={folder()}>
            <FileTree.Item id="home" title="index.tsx" icon={file()} />
            <FileTree.Item id="about" title="about.tsx" icon={file()} />
          </FileTree.Item>
          <FileTree.Item id="layout" title="_layout.tsx" icon={file()} />
        </FileTree.Item>
        <FileTree.Item id="vite" title="vite.config.ts" icon={file()} />
      </FileTree>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <ReducedMotion />
    </div>
  );
}

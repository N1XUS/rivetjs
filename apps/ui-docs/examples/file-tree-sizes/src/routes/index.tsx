// Rivet-authored FileTree demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { FileTree } from "@rivetjs/ui/file-tree";
import { File, Folder } from "lucide";

export const head = { title: "FileTree: Sizes" };

// #region demo
const folder = () => <Icon icon={Folder} size={16} />;
const file = () => <Icon icon={File} size={16} />;

export function Sizes() {
  return (
    <div class="grid w-full max-w-3xl gap-6 sm:grid-cols-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <div class="flex flex-col gap-2">
          <p class="text-xs font-medium text-muted">{size}</p>
          <FileTree aria-label={`Project ${size}`} size={size} defaultExpandedKeys={["src"]}>
            <FileTree.Item id="src" title="src" icon={folder()}>
              <FileTree.Item id="index" title="index.ts" icon={file()} />
              <FileTree.Item id="app" title="app.tsx" icon={file()} />
            </FileTree.Item>
            <FileTree.Item id="readme" title="README.md" icon={file()} />
          </FileTree>
        </div>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Sizes />
    </div>
  );
}

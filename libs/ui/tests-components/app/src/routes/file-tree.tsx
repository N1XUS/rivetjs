import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { FileTree } from "@rivetjs/ui/file-tree";
import { File, Folder } from "lucide";

export const head = { title: "FileTree" };

// Rivet addition (feature set inspired by HeroUI Pro's public File Tree docs): nested folders with icons and guide lines,
// multiple selection. Resumes on the first press / key.
export default function FileTreeStory() {
  const count = signal(0);
  const folder = () => <Icon icon={Folder} size={16} />;
  const file = () => <Icon icon={File} size={16} />;
  return (
    <main class="flex max-w-md flex-col gap-8 bg-background p-6 text-foreground">
      <FileTree
        id="ft"
        aria-label="Project"
        defaultExpandedKeys={["src"]}
        selectionMode="multiple"
        onSelectionChange={(k) => count.set(k === "all" ? -1 : k.size)}
      >
        <FileTree.Item id="src" title="src" icon={folder()}>
          <FileTree.Item id="components" title="components" icon={folder()}>
            <FileTree.Item id="button" title="button.tsx" icon={file()} />
          </FileTree.Item>
          <FileTree.Item id="index" title="index.ts" icon={file()} />
        </FileTree.Item>
        <FileTree.Item id="readme" title="README.md" icon={file()} />
      </FileTree>
      <p id="ft-count">{count()} selected</p>
    </main>
  );
}

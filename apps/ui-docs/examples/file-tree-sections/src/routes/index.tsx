// Rivet-authored FileTree demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { FileTree } from "@rivetjs/ui/file-tree";
import { FileCode, FileJson, Folder } from "lucide";

export const head = { title: "FileTree: Sections" };

// #region demo
const folder = () => <Icon icon={Folder} size={16} />;
const code = () => <Icon icon={FileCode} size={16} />;
const json = () => <Icon icon={FileJson} size={16} />;

export function Sections() {
  return (
    <div id="ft-sections" class="w-full max-w-xs">
      <FileTree aria-label="Workspace">
        <FileTree.Section id="source">
          <FileTree.Header>Source</FileTree.Header>
          <FileTree.Item id="components" title="components" icon={folder()}>
            <FileTree.Item id="button" title="button.tsx" icon={code()} />
            <FileTree.Item id="card" title="card.tsx" icon={code()} />
          </FileTree.Item>
          <FileTree.Item id="app" title="app.tsx" icon={code()} />
        </FileTree.Section>
        <FileTree.Section id="config">
          <FileTree.Header>Config</FileTree.Header>
          <FileTree.Item id="package" title="package.json" icon={json()} />
          <FileTree.Item id="tsconfig" title="tsconfig.json" icon={json()} />
        </FileTree.Section>
      </FileTree>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Sections />
    </div>
  );
}

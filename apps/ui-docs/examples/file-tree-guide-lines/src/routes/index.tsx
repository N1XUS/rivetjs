// Rivet-authored FileTree demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { FileTree } from "@rivetjs/ui/file-tree";
import { File, Folder } from "lucide";

export const head = { title: "FileTree: Guide Lines" };

// #region demo
const folder = () => <Icon icon={Folder} size={16} />;
const file = () => <Icon icon={File} size={16} />;

export function GuideLines() {
  const modes = [
    { label: "Always", value: true },
    { label: "On hover", value: "hover" },
    { label: "Off", value: false },
  ] as const;
  return (
    <div class="grid w-full max-w-3xl gap-6 sm:grid-cols-3">
      {modes.map((mode) => (
        <div class="flex flex-col gap-2">
          <p class="text-xs font-medium text-muted">{mode.label}</p>
          <FileTree aria-label={`Guide lines ${mode.label}`} showGuideLines={mode.value} defaultExpandedKeys={["src", "components"]}>
            <FileTree.Item id="src" title="src" icon={folder()}>
              <FileTree.Item id="components" title="components" icon={folder()}>
                <FileTree.Item id="button" title="button.tsx" icon={file()} />
              </FileTree.Item>
              <FileTree.Item id="index" title="index.ts" icon={file()} />
            </FileTree.Item>
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
      <GuideLines />
    </div>
  );
}

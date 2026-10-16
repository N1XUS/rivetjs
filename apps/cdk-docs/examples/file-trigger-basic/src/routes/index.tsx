import { signal } from "@rivetjs/reactivity";
import { FileTrigger } from "@rivetjs/cdk/file-trigger";
import { Button } from "@rivetjs/cdk/button";
import { Upload } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "FileTrigger with a Button" };

// #region demo
export default function PickFiles() {
  const names = signal<string[]>([]);
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <FileTrigger data-testid="photos" onSelect={(files) => names.set(files ? [...files].map((file) => file.name) : [])}>
        <Button id="pick" class="flex w-fit items-center gap-2 rounded-md border px-3 py-1.5 data-[hovered]:bg-slate-50">
          <Icon icon={Upload} />
          Select a file
        </Button>
      </FileTrigger>
      <p id="picked">{names().length ? names().join(", ") : "No file selected"}</p>
    </div>
  );
}
// #endregion

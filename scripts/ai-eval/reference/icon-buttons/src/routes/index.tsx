import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Icon } from "@rivetjs/kit/icon";
import { File, Trash2 } from "lucide";

export const head = { title: "Files" };

export default function Home() {
  const files = signal(["notes.txt", "photo.png", "song.mp3"]);
  return (
    <main class="mx-auto max-w-sm p-6">
      <ul id="files" class="grid gap-2">
        <For each={files} by={(file) => file}>
          {(file) => (
            <li data-file={file()} class="flex items-center gap-2">
              <Icon icon={File} size={16} />
              <span class="mr-auto">{file()}</span>
              <button type="button" aria-label={`Delete ${file()}`} onClick={() => files.update((list) => list.filter((f) => f !== file()))}>
                <Icon icon={Trash2} size={16} />
              </button>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}

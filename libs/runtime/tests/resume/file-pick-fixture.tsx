// Cold replay of a file input's `change` (resume-file-pick-browser.test.ts): each queued pick replays
// with the selection it made, not the input's latest one.
import { signal } from "@rivetjs/reactivity";

export function Page() {
  const picks = signal<string[]>([]);
  return (
    <main>
      <input
        id="files"
        type="file"
        multiple
        onChange={(event: Event) =>
          picks.update((list) => [...list, Array.from((event.currentTarget as HTMLInputElement).files ?? [], (file) => file.name).join("+")])
        }
      />
      <output id="picks">{picks().join(" | ")}</output>
    </main>
  );
}

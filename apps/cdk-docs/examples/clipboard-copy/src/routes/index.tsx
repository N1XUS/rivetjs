import { signal } from "@rivetjs/reactivity";
import { copy } from "@rivetjs/cdk/clipboard";

export const head = { title: "Copy to the clipboard" };

const command = "npm install @rivetjs/cdk";

// #region demo
export default function Install() {
  const status = signal("");
  const onCopy = async () => status.set((await copy(command)) ? "Copied" : "Copy failed: select the text instead");
  return (
    <section class="m-4 flex max-w-md items-center gap-2 text-sm">
      <code id="command" class="rounded bg-slate-100 px-2 py-1">
        {command}
      </code>
      <button id="copy" type="button" class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white" onClick={onCopy}>
        Copy
      </button>
      <span id="status" role="status" class="text-slate-600">
        {status()}
      </span>
    </section>
  );
}
// #endregion

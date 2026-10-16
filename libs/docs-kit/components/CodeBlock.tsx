import { Check, Copy } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

/**
 * Copy button in a code block's header: copies the first visible `<pre>` of its `.code-block` / `.code-panel` (the
 * open tab, or the source of a compiled block). Its code loads when you point at it.
 */
export function CopyButton() {
  return (
    <button
      type="button"
      class="copy-button"
      aria-label="Copy code"
      // Same handler on many buttons would otherwise prefetch when visible; copying is rare.
      preload="intent"
      onClick={(event) => {
        // Read the code from the DOM, so pages carry no code strings in resume state.
        // Resumed handlers are delegated from the document: `currentTarget` is the document, so start from `target`.
        const button = (event.target as Element).closest("button");
        const block = button?.closest(".code-block, .code-panel");
        const pres = block ? [...block.querySelectorAll("pre")] : [];
        const pre = pres.find((p) => p.offsetParent !== null) ?? pres[0];
        if (!button || !pre) return;
        const done = (label: string) => {
          button.dataset.copied = "";
          button.setAttribute("aria-label", label);
          setTimeout(() => {
            delete button.dataset.copied;
            button.setAttribute("aria-label", "Copy code");
          }, 1500);
        };
        void navigator.clipboard.writeText(pre.textContent ?? "").then(
          () => done("Copied"),
          () => button.setAttribute("aria-label", "Press Ctrl+C to copy"),
        );
      }}
    >
      <Icon icon={Copy} size={15} class="copy-icon" />
      <Icon icon={Check} size={15} class="copied-icon" />
    </button>
  );
}

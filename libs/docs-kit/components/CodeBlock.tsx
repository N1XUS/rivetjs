import { Check, Copy } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

/**
 * Copy button in a code block's header: copies the first visible `<pre>` of its `.code-block` / `.code-panel` (the
 * open tab, or the source of a compiled block). Plain markup: the docs page script (`page-script.ts` `copyCode`) acts on
 * its click (RT-DIET2 DOCS-CHROME: no boundary, no resume runtime; the code is read from the DOM).
 */
export function CopyButton() {
  return (
    <button type="button" class="copy-button" aria-label="Copy code">
      <Icon icon={Copy} size={15} class="copy-icon" />
      <Icon icon={Check} size={15} class="copied-icon" />
    </button>
  );
}

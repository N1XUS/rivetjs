// Rivet-only helper (no HeroUI counterpart): the copy-button behaviour shared by `ChatMessageActions.Copy` and
// `CodeBlock.CopyButton` (feature set inspired by HeroUI Pro's public AI docs; independent implementation).
// A plain function called from a resumable press handler: copies with `@rivetjs/cdk/clipboard` `copy`, then marks the
// button `data-copied="true"` + swaps its `aria-label` for `resetAfter` ms (icons swap in CSS). No signal: nothing is
// serialized, nothing runs before the press. `.tsx`: server-rewritten like the component modules.
import { copy } from "@rivetjs/cdk/clipboard";

/** Copy `text`; on success flag `button` (closest `[data-copy-button]` of `from`) as copied for `resetAfter` ms. */
export function copyWithFeedback(
  from: EventTarget | null,
  text: string,
  labels: { label: string; copiedLabel: string },
  onCopy?: (copied: boolean) => void,
  resetAfter = 2000,
): void {
  const button = ((from as Element | null)?.closest?.("[data-copy-button]") as HTMLElement | null) ?? null;
  void copy(text).then((ok) => {
    onCopy?.(ok);
    if (!ok || !button) return;
    button.setAttribute("data-copied", "true");
    button.setAttribute("aria-label", labels.copiedLabel);
    const previous = Number(button.dataset.copyTimer);
    if (previous) clearTimeout(previous);
    button.dataset.copyTimer = String(
      setTimeout(() => {
        button.removeAttribute("data-copied");
        button.setAttribute("aria-label", labels.label);
        delete button.dataset.copyTimer;
      }, resetAfter),
    );
  });
}

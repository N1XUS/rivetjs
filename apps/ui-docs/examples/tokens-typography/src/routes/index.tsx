// Rivet-authored demo: the typography tokens of the current theme, values read from the live CSS.
import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";

export const head = { title: "Typography: Tokens" };

// #region demo
const SCALE = [
  { utility: "text-4xl", class: "text-4xl font-semibold tracking-tight", use: "Page title" },
  { utility: "text-3xl", class: "text-3xl font-semibold tracking-tight", use: "Section title" },
  { utility: "text-2xl", class: "text-2xl font-semibold", use: "Heading" },
  { utility: "text-xl", class: "text-xl font-semibold", use: "Subheading" },
  { utility: "text-lg", class: "text-lg font-medium", use: "Lead, card titles" },
  { utility: "text-base", class: "text-base", use: "Long-form body" },
  { utility: "text-sm", class: "text-sm", use: "UI text, controls" },
  { utility: "text-xs", class: "text-xs", use: "Captions, chips, labels" },
];
const WEIGHTS = [
  { utility: "font-normal", class: "font-normal" },
  { utility: "font-medium", class: "font-medium" },
  { utility: "font-semibold", class: "font-semibold" },
  { utility: "font-bold", class: "font-bold" },
];
const PRICES = ["1,111.11", "88.80", "940.07", "17.19"];

/** Shortens long decimals of a computed value (`oklch(0.5200001 …)` → `oklch(0.52 …)`). */
function tidy(value: string) {
  return value
    .trim()
    .replace(/\d*\.\d{4,}/g, (n) => String(+(+n).toFixed(3)))
    .replace(/(^|[^\d])\.(\d)/g, (_, before: string, digit: string) => `${before}0.${digit}`)
    .replace(/(^|[^\d.])-0(?![.\d])/g, (_, before: string) => `${before}0`)
    .replace(/\d[\d.]*e\+\d+px/g, "calc(infinity * 1px)");
}
export function TypeTokens() {
  // Resolved CSS of every [data-token] element, root included (properties in data-prop, space-separated, default background-color;
  // data-target measures a descendant), read in the browser on load and again on every light / dark switch.
  const values = signal<Record<string, string>>({});
  const root = ref<HTMLElement>();
  clientEffect(() => {
    const el = root();
    if (!el) return;
    const read = () =>
      values.set(
        Object.fromEntries(
          [el, ...el.querySelectorAll<HTMLElement>("[data-token]")]
            .filter((n) => n.dataset.token)
            .map((n) => {
              const style = getComputedStyle((n.dataset.target && n.querySelector(n.dataset.target)) || n);
              const props = (n.dataset.prop ?? "background-color").split(" ");
              return [n.dataset.token!, props.map((p) => tidy(style.getPropertyValue(p))).join(" · ")];
            }),
        ),
      );
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  });
  const value = (key: string) => (
    <span data-value={key} class="font-mono text-xs text-muted tabular-nums">
      {() => values()[key] ?? ""}
    </span>
  );
  return (
    <div ref={root} class="grid gap-8 p-4 sm:p-6">
      <section class="grid gap-3" aria-label="Type scale">
        {SCALE.map((s) => (
          <div class="grid gap-1 border-b border-separator pb-3 sm:grid-cols-[9rem_1fr] sm:items-baseline sm:gap-4">
            <div class="grid">
              <code class="font-mono text-xs font-medium">{s.utility}</code>
              {value(s.utility)}
            </div>
            <p data-token={s.utility} data-prop="font-size line-height" class={`m-0 truncate ${s.class}`}>
              {s.use}
            </p>
          </div>
        ))}
      </section>
      <section class="grid gap-6 sm:grid-cols-3" aria-label="Weights, families and figures">
        <div class="grid content-start gap-2">
          <h3 class="m-0 text-sm font-semibold">Weights</h3>
          {WEIGHTS.map((w) => (
            <p data-token={w.utility} data-prop="font-weight" class={`m-0 flex items-baseline justify-between gap-2 text-base ${w.class}`}>
              <span>Rivet {w.utility.slice(5)}</span>
              {value(w.utility)}
            </p>
          ))}
        </div>
        <div class="grid content-start gap-2">
          <h3 class="m-0 text-sm font-semibold">Families</h3>
          <p data-token="font-sans" data-prop="font-family" class="m-0 grid font-sans text-base">
            Sans: Aa Gg 0123
            {value("font-sans")}
          </p>
          <p data-token="font-mono" data-prop="font-family" class="m-0 grid font-mono text-sm">
            Mono: Aa Gg 0123
            {value("font-mono")}
          </p>
        </div>
        <div class="grid content-start gap-2">
          <h3 class="m-0 text-sm font-semibold">Figures</h3>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="grid justify-items-end">
              <span class="text-xs text-muted">proportional</span>
              {PRICES.map((p) => (
                <span>${p}</span>
              ))}
            </div>
            <div class="grid justify-items-end tabular-nums">
              <span class="text-xs text-muted">tabular-nums</span>
              {PRICES.map((p) => (
                <span>${p}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
// #endregion

export default function Page() {
  return <TypeTokens />;
}

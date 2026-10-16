// Rivet-authored demo: icon boxes per control size, measured from the live CSS. Icons from lucide via @rivetjs/kit/icon.
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { Button } from "@rivetjs/ui/button";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { Star } from "lucide";

export const head = { title: "Styling: Icon sizes" };

// #region demo
/** Shortens long decimals of a computed value (`oklch(0.5200001 …)` → `oklch(0.52 …)`). */
function tidy(value: string) {
  return value
    .trim()
    .replace(/\d*\.\d{4,}/g, (n) => String(+(+n).toFixed(3)))
    .replace(/(^|[^\d])\.(\d)/g, (_, before: string, digit: string) => `${before}0.${digit}`)
    .replace(/(^|[^\d.])-0(?![.\d])/g, (_, before: string) => `${before}0`)
    .replace(/\d[\d.]*e\+\d+px/g, "calc(infinity * 1px)");
}
export function IconSizes() {
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
  const row = (key: string, label: string, text: string, control: Content) => (
    <div class="grid grid-cols-[minmax(8rem,auto)_1fr] items-center gap-4 sm:grid-cols-[10rem_10rem_1fr]">
      <span class="text-sm">{label}</span>
      <div data-token={key} data-prop="width stroke-width" data-target="svg" class="flex items-center">
        {control}
      </div>
      <span data-value={key} class="col-span-2 font-mono text-xs text-muted tabular-nums sm:col-span-1">
        {() => values()[key] ?? ""} <span class="text-muted">next to {text}</span>
      </span>
    </div>
  );
  return (
    <div ref={root} class="grid gap-4 p-4 sm:p-6">
      {row(
        "tag-sm",
        "Tag sm",
        "12 px text",
        <TagGroup size="sm" aria-label="Small tags">
          <TagGroup.List>
            <Tag>
              <Icon icon={Star} />
              Starred
            </Tag>
          </TagGroup.List>
        </TagGroup>,
      )}
      {row(
        "tag-md",
        "Tag md",
        "12 px text",
        <TagGroup aria-label="Tags">
          <TagGroup.List>
            <Tag>
              <Icon icon={Star} />
              Starred
            </Tag>
          </TagGroup.List>
        </TagGroup>,
      )}
      {row(
        "button-sm",
        "Button sm",
        "14 px text",
        <Button size="sm" variant="secondary">
          <Icon icon={Star} />
          Star
        </Button>,
      )}
      {row(
        "button-md",
        "Button md",
        "14 px text",
        <Button variant="secondary">
          <Icon icon={Star} />
          Star
        </Button>,
      )}
      {row(
        "button-lg",
        "Button lg",
        "16 px text",
        <Button size="lg" variant="secondary">
          <Icon icon={Star} />
          Star
        </Button>,
      )}
      {row(
        "toggle-lg",
        "ToggleButton lg",
        "16 px text",
        <ToggleButton size="lg" aria-label="Favourite" isIconOnly>
          <Icon icon={Star} />
        </ToggleButton>,
      )}
    </div>
  );
}
// #endregion

export default function Page() {
  return <IconSizes />;
}

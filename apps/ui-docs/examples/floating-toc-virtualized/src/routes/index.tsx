// Rivet-authored FloatingToc demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import type { Selection } from "@rivetjs/cdk/listbox";
import { computed, signal } from "@rivetjs/reactivity";
import { FloatingToc } from "@rivetjs/ui/floating-toc";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "FloatingToc: Virtualized" };

// #region demo
// 400 releases, newest first: a minor release is a top-level section, its patches are nested.
const RELEASES = Array.from({ length: 400 }, (_, i) => {
  const major = 4 - Math.floor(i / 100);
  const minor = 9 - Math.floor((i % 100) / 10);
  const patch = 9 - (i % 10);
  return { id: `v${major}.${minor}.${patch}`, title: `Version ${major}.${minor}.${patch}`, level: patch === 0 ? 1 : 2 };
});
const BARS = 9;

export function Virtualized() {
  const open = signal(false);
  const selected = signal<Selection>(new Set([RELEASES[0]!.id]));
  const activeIndex = computed(() => {
    const key = [...(selected() as Set<string>)][0];
    return Math.max(
      0,
      RELEASES.findIndex((r) => r.id === key),
    );
  });
  // The trigger shows a window of BARS bars around the active release instead of one bar per release.
  const first = computed(() => Math.min(Math.max(activeIndex() - Math.floor(BARS / 2), 0), RELEASES.length - BARS));
  return (
    <div class="flex w-full max-w-2xl items-start justify-between gap-6">
      <article class="flex max-w-56 flex-col gap-1">
        <span class="text-xs text-muted">
          Release {activeIndex() + 1} of {RELEASES.length}
        </span>
        <h3 id="toc-virtual-heading" class="text-lg font-semibold">
          {RELEASES[activeIndex()]!.title}
        </h3>
        <p class="text-sm text-muted">Open the list and pick another release: only the rows in view are rendered.</p>
      </article>
      <FloatingToc open={open} triggerMode="press">
        <FloatingToc.Trigger id="toc-virtual">
          {Array.from({ length: BARS }, (_, i) => (
            <FloatingToc.Bar level={RELEASES[first() + i]!.level} active={first() + i === activeIndex()} />
          ))}
        </FloatingToc.Trigger>
        <FloatingToc.Content aria-label="Releases" class="overflow-hidden">
          <ListBox
            virtualized
            autoFocus
            aria-label="Releases"
            items={RELEASES}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={selected}
            onSelectionChange={() => open.set(false)}
            class="h-[288px] w-56"
            initialSize={{ width: 224, height: 288 }}
          >
            {(release: (typeof RELEASES)[number]) => (
              <ListBox.Item id={release.id} textValue={release.title} class={release.level === 2 ? "ps-6" : "font-medium"}>
                {release.title}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </ListBox>
        </FloatingToc.Content>
      </FloatingToc>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6">
      <Virtualized />
    </div>
  );
}

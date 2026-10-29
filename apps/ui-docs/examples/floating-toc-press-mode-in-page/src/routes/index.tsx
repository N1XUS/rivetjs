// Rivet-authored FloatingToc demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { FloatingToc } from "@rivetjs/ui/floating-toc";

export const head = { title: "FloatingToc: Press Mode In Page" };

// #region demo
const SECTIONS = [
  { id: "overview", title: "Overview", level: 1 },
  { id: "install", title: "Installation", level: 1 },
  { id: "config", title: "Configuration", level: 2 },
  { id: "themes", title: "Themes", level: 2 },
  { id: "usage", title: "Usage", level: 1 },
  { id: "faq", title: "FAQ", level: 1 },
];

export function PressModeInPage() {
  const active = signal("overview");
  clientEffect(() => {
    const scroller = document.getElementById("toc-press-page");
    if (!scroller) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) active.set(entry.target.id.replace("press-sec-", ""));
      },
      { root: scroller, rootMargin: "0px 0px -70% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(`press-sec-${s.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  });
  const go = (id: string) => document.getElementById(`press-sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div class="relative w-full max-w-xl">
      <div id="toc-press-page" class="h-96 overflow-y-auto rounded-2xl bg-surface p-6 pe-16 shadow-surface">
        {SECTIONS.map((s) => (
          <section id={`press-sec-${s.id}`} class="mb-6 min-h-48">
            <h3 class="mb-2 text-base font-semibold">{s.title}</h3>
            <p class="text-sm text-muted">Section text for {s.title.toLowerCase()}. Press the bars to open the list; pick a section to scroll to it.</p>
          </section>
        ))}
      </div>
      <div class="absolute end-2 top-4">
        <FloatingToc triggerMode="press">
          <FloatingToc.Trigger id="toc-press-page-trigger">
            {SECTIONS.map((s) => (
              <FloatingToc.Bar level={s.level} active={active() === s.id} />
            ))}
          </FloatingToc.Trigger>
          <FloatingToc.Content aria-label="On this page">
            {SECTIONS.map((s) => (
              <FloatingToc.Item id={`toc-press-page-${s.id}`} level={s.level} active={active() === s.id} onPress={() => go(s.id)}>
                {s.title}
              </FloatingToc.Item>
            ))}
          </FloatingToc.Content>
        </FloatingToc>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <PressModeInPage />
    </div>
  );
}
